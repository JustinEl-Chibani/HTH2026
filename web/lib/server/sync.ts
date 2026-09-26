// Mirrors on-chain Bet state into the DB. The chain is the source of truth: the client only tells us
// "something happened" (optionally with a tx signature); we re-read the account and diff.
// Relative imports only — also used by scripts/resolver.ts.
import type { Bet, Prisma, User } from "@prisma/client";
import { PublicKey } from "@solana/web3.js";
import { prisma } from "../db";
import { decodeBet, TERMINAL_STATES, type ChainBet, type RawBetAccount } from "../solana/codec";
import { getReadonlyProgram } from "../solana/program";
import { withRetry } from "../solana/retry";
import { formatPrice, formatUsd } from "../money";
import { hashJson } from "../terms";
import { notify } from "./notify";
import { connection } from "./solana";

export interface SyncOptions {
  txSig?: string | null;
  /** Proposed canonical terms JSON (counteroffers); stored only if its hash matches the chain. */
  termsJson?: string | null;
  /** Extra data merged into the event created for this transition (e.g. oracle price source). */
  eventData?: Record<string, unknown>;
}

export async function fetchChainBet(betPda: string): Promise<ChainBet | null> {
  const program = getReadonlyProgram(connection());
  const raw = await withRetry(() => program.account.bet.fetchNullable(new PublicKey(betPda)));
  return raw ? decodeBet(raw as unknown as RawBetAccount) : null;
}

async function txSucceeded(sig: string): Promise<boolean> {
  try {
    const st = await withRetry(() => connection().getSignatureStatus(sig, { searchTransactionHistory: true }));
    return !!st.value && !st.value.err;
  } catch {
    return false;
  }
}

async function latestSig(betPda: string): Promise<string | null> {
  try {
    const sigs = await connection().getSignaturesForAddress(new PublicKey(betPda), { limit: 1 });
    return sigs[0]?.signature ?? null;
  } catch {
    return null;
  }
}

/** On-chain opponent of an open bet nobody has taken yet (the default pubkey). */
const OPEN_OPPONENT = PublicKey.default.toBase58();

const date = (unix: number) => (unix > 0 ? new Date(unix * 1000) : null);

type BetWithUsers = Bet & { creator: User; opponent: User | null };

/** Re-read the chain and update the DB row, emitting events + notifications for every transition. */
export async function syncBet(betId: string, opts: SyncOptions = {}): Promise<Bet> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const bet = await prisma.bet.findUniqueOrThrow({
      where: { id: betId },
      include: { creator: true, opponent: true },
    });
    const chain = await fetchChainBet(bet.betPda);
    if (!chain) return bet; // not created on-chain (yet)
    const result = await applyChain(bet, chain, opts);
    if (result) return result;
    // Someone else updated the row concurrently; re-read and diff again.
  }
  return prisma.bet.findUniqueOrThrow({ where: { id: betId } });
}

async function applyChain(bet: BetWithUsers, chain: ChainBet, opts: SyncOptions): Promise<Bet | null> {
  const mismatch = () => new Error(`Bet ${bet.id}: on-chain participants don't match the DB record`);
  if (chain.creator !== bet.creator.wallet) throw mismatch();
  // Open (public) bets have no opponent until someone takes them; then the chain names the taker.
  let opponent: User | null = bet.opponent;
  let takerId: string | null = null;
  if (!opponent) {
    if (chain.opponent !== OPEN_OPPONENT) {
      if (!bet.isPublic) throw mismatch();
      const taker = await prisma.user.findUnique({ where: { wallet: chain.opponent } });
      if (!taker) throw new Error(`Bet ${bet.id}: taker ${chain.opponent} has no account`);
      opponent = taker;
      takerId = taker.id;
    }
  } else if (chain.opponent !== opponent.wallet) {
    throw mismatch();
  }
  const creator = bet.creator;
  const userByWallet = (w: string | null) =>
    w === creator.wallet ? creator : opponent && w === opponent.wallet ? opponent : null;
  // Only reached once the bet has both sides (every transition after PROPOSED).
  const other = (u: User) => (u.id === creator.id ? opponent! : creator);
  const holderOf = (side: string) => (side === chain.creatorSide ? creator : opponent!);
  const both = opponent ? [creator, opponent] : [creator];

  const txSig = opts.txSig && (await txSucceeded(opts.txSig)) ? opts.txSig : null;

  // Which terms JSON describes the current on-chain version?
  let termsJson = bet.termsJson;
  if (opts.termsJson && hashJson(opts.termsJson) === chain.termsHash) termsJson = opts.termsJson;
  else if (hashJson(bet.termsJson) !== chain.termsHash) {
    // Unknown text for this hash (client didn't send it) — keep the last known text.
    termsJson = bet.termsJson;
  }

  const data: Prisma.BetUncheckedUpdateManyInput = {
    ...(takerId ? { opponentId: takerId } : {}),
    state: chain.state,
    version: chain.version,
    creatorSide: chain.creatorSide,
    creatorStake: chain.creatorStake,
    opponentStake: chain.opponentStake,
    termsHash: chain.termsHash,
    termsJson,
    oracleJson: chain.oracle
      ? JSON.stringify({ ...chain.oracle, threshold: chain.oracle.threshold.toString() })
      : null,
    creatorFunded: chain.creatorFunded,
    opponentFunded: chain.opponentFunded,
    acceptDeadline: date(chain.acceptDeadline),
    fundingDeadline: date(chain.fundingDeadline),
    eventDeadline: date(chain.eventDeadline) ?? bet.eventDeadline,
    resolveDeadline: date(chain.resolveDeadline),
    proposedWinner: chain.proposedOutcome,
    proposedById: userByWallet(chain.proposedBy)?.id ?? null,
    winnerSide: chain.winner,
    resolvedValue: chain.resolvedValue,
    lastProposerId: userByWallet(chain.lastProposer)?.id ?? null,
  };

  const events: { type: string; actorId: string | null; data?: Record<string, unknown> }[] = [];
  const notes: { userId: string; type: string; message: string }[] = [];
  const name = (u: User) => `@${u.username}`;
  const lastProposer = userByWallet(chain.lastProposer) ?? creator;
  const stakesText = `${formatUsd(chain.creatorStake)} vs ${formatUsd(chain.opponentStake)}`;

  if (bet.state === "DRAFT" && chain.state !== "DRAFT") {
    events.push({ type: "CREATED", actorId: creator.id });
    if (opponent) notes.push({
      userId: opponent.id,
      type: "CHALLENGE",
      message: `${name(creator)} challenged you: ${bet.title} (${formatUsd(chain.opponentStake)} to win ${formatUsd(chain.creatorStake)})`,
    });
  }
  if (chain.version > bet.version && bet.state !== "DRAFT") {
    events.push({ type: "COUNTERED", actorId: lastProposer.id, data: { version: chain.version } });
    notes.push({
      userId: other(lastProposer).id,
      type: "COUNTER",
      message: `${name(lastProposer)} countered with v${chain.version}: ${stakesText}`,
    });
  }
  const was = bet.state;
  const now = chain.state;
  if (was !== now) {
    if (now === "ACCEPTED") {
      const acceptor = other(lastProposer);
      events.push({ type: "ACCEPTED", actorId: acceptor.id, data: { version: chain.version, ...(takerId ? { taken: true } : {}) } });
      notes.push({
        userId: lastProposer.id,
        type: "ACCEPTED",
        message: takerId
          ? `${name(acceptor)} took your open bet and put their ${formatUsd(chain.opponentStake)} in. Fund your side to lock it in.`
          : `${name(acceptor)} accepted! Fund your side to lock it in.`,
      });
    }
  }
  if (chain.creatorFunded && !bet.creatorFunded) {
    events.push({ type: "FUNDED", actorId: creator.id, data: { amount: chain.creatorStake.toString() } });
    if (!chain.opponentFunded) notes.push({ userId: opponent!.id, type: "FUNDED", message: `${name(creator)} put their ${formatUsd(chain.creatorStake)} in. Your turn.` });
  }
  if (chain.opponentFunded && !bet.opponentFunded) {
    events.push({ type: "FUNDED", actorId: opponent!.id, data: { amount: chain.opponentStake.toString() } });
    // (A taker funds in the same transaction; the "took your bet" note already says so.)
    if (!chain.creatorFunded && !takerId) notes.push({ userId: creator.id, type: "FUNDED", message: `${name(opponent!)} put their ${formatUsd(chain.opponentStake)} in. Your turn.` });
  }
  if (was !== now) {
    const pot = formatUsd(chain.creatorStake + chain.opponentStake);
    if (now === "ACTIVE" && was !== "AWAITING_CONFIRMATION") {
      events.push({ type: "ACTIVE", actorId: null, data: { pot: (chain.creatorStake + chain.opponentStake).toString() } });
      for (const u of both) notes.push({ userId: u.id, type: "ACTIVE", message: `It's on! ${pot} locked in escrow: ${bet.title}` });
    }
    if (now === "AWAITING_CONFIRMATION") {
      const by = userByWallet(chain.proposedBy) ?? creator;
      const outcome = chain.proposedOutcome;
      const claim = outcome === "VOID" ? "calling it off" : `${name(holderOf(outcome!))} won`;
      events.push({ type: "OUTCOME_PROPOSED", actorId: by.id, data: { outcome } });
      notes.push({ userId: other(by).id, type: "OUTCOME_PROPOSED", message: `${name(by)} says ${claim}. Confirm or dispute.` });
    }
    if (now === "ACTIVE" && was === "AWAITING_CONFIRMATION") {
      const proposer = bet.proposedById === creator.id ? creator : opponent!;
      events.push({ type: "OUTCOME_REJECTED", actorId: other(proposer).id });
      notes.push({ userId: proposer.id, type: "OUTCOME_REJECTED", message: `${name(other(proposer))} disputed the result. Talk it out and try again.` });
    }
    if (now === "SETTLED" && chain.winner) {
      const winner = holderOf(chain.winner);
      const loser = other(winner);
      const amount = chain.creatorStake + chain.opponentStake;
      events.push({
        type: "SETTLED",
        actorId: null,
        data: {
          winnerSide: chain.winner,
          winnerId: winner.id,
          amount: amount.toString(),
          resolvedValue: chain.resolvedValue?.toString() ?? null,
          ...opts.eventData,
        },
      });
      const how = chain.resolvedValue != null ? ` (${formatPrice(chain.resolvedValue)})` : "";
      notes.push({ userId: winner.id, type: "WON", message: `You won ${formatUsd(amount)}${how}! ${bet.title}` });
      notes.push({ userId: loser.id, type: "LOST", message: `${name(winner)} won ${formatUsd(amount)}${how}. ${bet.title}` });
    }
    if (now === "CANCELLED") {
      events.push({ type: "CANCELLED", actorId: null });
      for (const u of both) notes.push({ userId: u.id, type: "CANCELLED", message: `Called off: ${bet.title}` });
    }
    if (now === "EXPIRED" || now === "VOID") {
      events.push({ type: now, actorId: null, data: opts.eventData });
      const refunded = chain.creatorFunded || chain.opponentFunded ? " Refunds sent." : "";
      for (const u of both) notes.push({ userId: u.id, type: now, message: `${now === "VOID" ? "Voided" : "Expired"}: ${bet.title}.${refunded}` });
    }
  }

  const changed = events.length > 0 || Object.entries(data).some(([k, v]) => {
    const cur = (bet as unknown as Record<string, unknown>)[k];
    if (v instanceof Date) return !(cur instanceof Date) || cur.getTime() !== v.getTime();
    return (cur ?? null) !== (v ?? null);
  });
  if (!changed) {
    // Polling may have recorded this transition first (without a signature); attach the client's tx.
    if (txSig) {
      const alreadyLinked = await prisma.betEvent.findFirst({ where: { betId: bet.id, txSig } });
      const recent = await prisma.betEvent.findFirst({
        where: { betId: bet.id, txSig: null, createdAt: { gt: new Date(Date.now() - 120_000) } },
        orderBy: { createdAt: "desc" },
      });
      if (recent && !alreadyLinked) await prisma.betEvent.update({ where: { id: recent.id }, data: { txSig } });
    }
    return bet;
  }

  let sig = txSig;
  if (!sig && events.length && TERMINAL_STATES.includes(now)) sig = await latestSig(bet.betPda);

  const versionRow =
    chain.version >= 1 && chain.state !== "DRAFT"
      ? {
          betId: bet.id,
          version: chain.version,
          proposerId: lastProposer.id,
          creatorStake: chain.creatorStake,
          opponentStake: chain.opponentStake,
          creatorSide: chain.creatorSide,
          termsJson,
          eventDeadline: date(chain.eventDeadline) ?? bet.eventDeadline,
          txSig: events.some((e) => e.type === "CREATED" || e.type === "COUNTERED") ? sig : null,
        }
      : null;

  try {
    return await prisma.$transaction(async (tx) => {
      // Optimistic concurrency: only apply if nobody else synced since we read the row.
      const res = await tx.bet.updateMany({ where: { id: bet.id, updatedAt: bet.updatedAt }, data });
      if (res.count === 0) throw new ConcurrentSync();
      if (versionRow) {
        await tx.betVersion.upsert({
          where: { betId_version: { betId: bet.id, version: versionRow.version } },
          update: {},
          create: versionRow,
        });
      }
      for (const e of events) {
        await tx.betEvent.create({
          data: { betId: bet.id, type: e.type, actorId: e.actorId, txSig: sig, data: e.data ? JSON.stringify(e.data) : null },
        });
      }
      for (const n of notes) await notify(n.userId, n.type, n.message, bet.id, tx);
      return tx.bet.findUniqueOrThrow({ where: { id: bet.id } });
    });
  } catch (e) {
    if (e instanceof ConcurrentSync) return null;
    throw e;
  }
}

class ConcurrentSync extends Error {}
