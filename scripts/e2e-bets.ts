// Bet flows for scripts/e2e.ts: every on-chain step is signed locally (like the wallet would) and then
// reported to /api/bets/[id]/sync, exactly like the browser.
import { AnchorProvider, Wallet } from "@anchor-lang/core";
import { PublicKey, Transaction, sendAndConfirmTransaction, type TransactionInstruction } from "@solana/web3.js";
import type { BetDTO } from "../web/lib/bet-types";
import * as ix from "../web/lib/solana/instructions";
import { getProgram, makeConnection } from "../web/lib/solana/program";
import { termsJsonAndHash, type Terms } from "../web/lib/terms";
import { expectFail, ok, type Client } from "./e2e";

const conn = makeConnection();
const MINT = new PublicKey(process.env.NEXT_PUBLIC_USDC_MINT!);
const USD = 1_000_000n;
const pk = (s: string) => new PublicKey(s);

function programFor(c: Client) {
  return getProgram(new AnchorProvider(conn, new Wallet(c.kp), { commitment: "confirmed" }));
}

async function send(c: Client, ixs: TransactionInstruction[]): Promise<string> {
  return sendAndConfirmTransaction(conn, new Transaction().add(...ixs), [c.kp], { commitment: "confirmed" });
}

async function sync(c: Client, bet: { id: string }, txSig: string, termsJson?: string) {
  return (await c.req<{ bet: BetDTO }>(`/api/bets/${bet.id}/sync`, { txSig, termsJson })).bet;
}

export async function createBet(
  a: Client,
  opponentUsername: string,
  over: Partial<{ resolution: "ORACLE" | "MUTUAL"; deadlineSecs: number; creatorStake: bigint; opponentStake: bigint; threshold: bigint; kind: string }> = {},
) {
  const resolution = over.resolution ?? "ORACLE";
  const draft = {
    opponentUsername,
    title: resolution === "ORACLE" ? "SOL above $1 soon" : "Alex can't run 5K under 25 min",
    conditionText:
      resolution === "ORACLE"
        ? "YES if the Pyth SOL/USD price is at or above $1.00 at the deadline."
        : "YES if Alex fails to run 5K in under 25:00 by the deadline.",
    creatorSide: "YES" as const,
    creatorStake: String(over.creatorStake ?? 10n * USD),
    opponentStake: String(over.opponentStake ?? 10n * USD),
    resolution,
    oracle:
      resolution === "ORACLE"
        ? { feed: "SOL_USD" as const, kind: (over.kind ?? "ABOVE_AT") as "ABOVE_AT", threshold: String(over.threshold ?? 1_000_000n) }
        : null,
    eventDeadline: new Date(Date.now() + (over.deadlineSecs ?? 3600) * 1000).toISOString(),
  };
  const { bet, chain } = await a.req<{ bet: BetDTO; chain: { betId: string; betPda: string; termsHash: string; acceptDeadline: number; eventDeadline: number; opponentWallet: string } }>(
    "/api/bets",
    draft,
  );
  const sig = await send(a, [
    await ix.createBetIx(programFor(a), {
      creator: a.kp.publicKey,
      bet: pk(chain.betPda),
      mint: MINT,
      betId: BigInt(chain.betId),
      opponent: pk(chain.opponentWallet),
      creatorSide: draft.creatorSide,
      creatorStake: BigInt(draft.creatorStake),
      opponentStake: BigInt(draft.opponentStake),
      termsHash: chain.termsHash,
      resolution,
      oracle: draft.oracle ? { ...draft.oracle, threshold: BigInt(draft.oracle.threshold) } : null,
      acceptDeadline: chain.acceptDeadline,
      eventDeadline: chain.eventDeadline,
    }),
  ]);
  return sync(a, bet, sig);
}

export async function counter(c: Client, bet: BetDTO, creatorStake: bigint, opponentStake: bigint, creatorSide: "YES" | "NO") {
  const prev = JSON.parse(bet.termsJson) as Terms;
  const { termsJson, termsHash } = termsJsonAndHash({ ...prev, creatorSide, creatorStake: String(creatorStake), opponentStake: String(opponentStake) });
  const sig = await send(c, [
    await ix.counterOfferIx(programFor(c), {
      signer: c.kp.publicKey,
      bet: pk(bet.betPda),
      expectedVersion: bet.version,
      creatorStake,
      opponentStake,
      creatorSide,
      termsHash,
      eventDeadline: Math.floor(Date.parse(bet.eventDeadline) / 1000),
      oracle: bet.oracle ? { ...bet.oracle, threshold: BigInt(bet.oracle.threshold) } : null,
    }),
  ]);
  return sync(c, bet, sig, termsJson);
}

export async function accept(c: Client, bet: BetDTO, version = bet.version) {
  const sig = await send(c, [await ix.acceptIx(programFor(c), { signer: c.kp.publicKey, bet: pk(bet.betPda), expectedVersion: version })]);
  return sync(c, bet, sig);
}

export async function fund(c: Client, bet: BetDTO) {
  const sig = await send(c, [await ix.fundIx(programFor(c), { funder: c.kp.publicKey, bet: pk(bet.betPda), mint: MINT })]);
  return sync(c, bet, sig);
}

const settle = (bet: BetDTO) => ({ bet: pk(bet.betPda), creator: pk(bet.creator.wallet), opponent: pk(bet.opponent!.wallet), mint: MINT });

export async function propose(c: Client, bet: BetDTO, outcome: "YES" | "NO" | "VOID") {
  const sig = await send(c, [await ix.proposeOutcomeIx(programFor(c), { signer: c.kp.publicKey, bet: pk(bet.betPda), outcome })]);
  return sync(c, bet, sig);
}

export async function confirm(c: Client, bet: BetDTO) {
  const sig = await send(c, [await ix.confirmOutcomeIx(programFor(c), { signer: c.kp.publicKey, ...settle(bet) })]);
  return sync(c, bet, sig);
}

export async function reject(c: Client, bet: BetDTO) {
  const sig = await send(c, [await ix.rejectOutcomeIx(programFor(c), { signer: c.kp.publicKey, bet: pk(bet.betPda) })]);
  return sync(c, bet, sig);
}

export async function cancel(c: Client, bet: BetDTO) {
  const sig = await send(c, [await ix.cancelIx(programFor(c), { signer: c.kp.publicKey, bet: pk(bet.betPda), creator: pk(bet.creator.wallet) })]);
  return sync(c, bet, sig);
}

async function usdcOf(c: Client): Promise<bigint> {
  const { getAssociatedTokenAddressSync } = await import("@solana/spl-token");
  const bal = await conn.getTokenAccountBalance(getAssociatedTokenAddressSync(MINT, c.kp.publicKey));
  return BigInt(bal.value.amount);
}

export async function betFlows({ a, b, tag }: { a: Client; b: Client; tag: string }) {
  const alex = `alex_${tag}`;

  console.log("\n[negotiate → fund] oracle bet");
  let bet = await createBet(a, alex);
  ok(bet.state === "PROPOSED" && bet.version === 1, "justin's challenge is PROPOSED v1 (synced from chain)");
  const inbox = await b.req<{ bets: BetDTO[] }>("/api/bets?filter=active");
  ok(inbox.bets.some((x) => x.id === bet.id), "alex sees the challenge in his bets");
  await expectFail(accept(a, bet), "justin can't accept his own offer");

  const v1 = bet;
  bet = await counter(b, bet, 10n * USD, 50n * USD, "YES");
  ok(bet.version === 2 && bet.opponentStake === String(50n * USD), "alex counters: takes NO for $50 (v2)");
  ok(bet.lastProposerId === bet.opponent!.id, "last proposer is alex");
  await expectFail(accept(a, v1, 1), "accepting stale v1 fails (VersionMismatch)");

  bet = await accept(a, bet);
  ok(bet.state === "ACCEPTED", "justin accepts v2");
  const beforeA = await usdcOf(a);
  bet = await fund(a, bet);
  ok(bet.creatorFunded && bet.state === "ACCEPTED", "justin funded $10");
  bet = await fund(b, bet);
  ok(bet.state === "ACTIVE", "alex funded $50 → ACTIVE");
  ok(beforeA - (await usdcOf(a)) === 10n * USD, "justin's balance dropped by exactly $10");

  const detail = (await a.req<{ bet: BetDTO }>(`/api/bets/${bet.id}`)).bet;
  ok(detail.versions?.map((v) => v.version).join(",") === "1,2", "negotiation history has v1, v2");
  ok(
    ["CREATED", "COUNTERED", "ACCEPTED", "FUNDED", "FUNDED", "ACTIVE"].every((t, i) => detail.events?.[i]?.type === t),
    `event timeline: ${detail.events?.map((e) => e.type).join(" → ")}`,
  );
  ok(JSON.parse(detail.termsJson).opponentStake === String(50n * USD), "stored terms text matches the v2 on-chain hash");

  // Non-participants can't sync; refresh is idempotent.
  const { Client: C } = await import("./e2e");
  const { Keypair } = await import("@solana/web3.js");
  const eve = new C(Keypair.generate(), "eve");
  await eve.signIn(`eve_${tag}`);
  await expectFail(eve.req(`/api/bets/${bet.id}/sync`, {}), "non-participant can't sync");
  const r1 = await a.req<{ bet: BetDTO }>(`/api/bets/${bet.id}/refresh`, {});
  ok(r1.bet.events?.length === detail.events?.length, "refresh doesn't duplicate events");

  console.log("\n[mutual] propose → reject → propose → confirm");
  let m = await createBet(a, alex, { resolution: "MUTUAL" });
  m = await accept(b, m);
  m = await fund(a, m);
  m = await fund(b, m);
  ok(m.state === "ACTIVE", "mutual bet active ($20 pot)");
  m = await propose(a, m, "YES");
  ok(m.state === "AWAITING_CONFIRMATION", "justin claims YES");
  await expectFail(confirm(a, m), "justin can't confirm his own claim");
  m = await reject(b, m);
  ok(m.state === "ACTIVE", "alex disputes → back to ACTIVE");
  m = await propose(b, m, "YES");
  const beforeWin = await usdcOf(a);
  m = await confirm(a, m);
  ok(m.state === "SETTLED" && m.winnerSide === "YES", "alex concedes, justin confirms → SETTLED");
  ok((await usdcOf(a)) - beforeWin === 20n * USD, "justin received the $20 pot");
  const settled = (await a.req<{ bet: BetDTO }>(`/api/bets/${m.id}`)).bet;
  ok(!!settled.finalTxSig, "payout tx signature recorded");
  const stats = await a.req<{ record: { wins: number; net: string } }>("/api/stats/me");
  ok(stats.record.wins === 1 && stats.record.net === String(10n * USD), "justin's record: 1 win, +$10");

  console.log("\n[decline]");
  let c = await createBet(a, alex);
  c = await cancel(b, c);
  ok(c.state === "CANCELLED", "alex declines → CANCELLED");

  console.log("\n[resolver] touch bet resolves early");
  const { runResolverTick } = await import("../web/lib/server/resolver");
  const quiet = () => {};
  let t = await createBet(a, alex, { kind: "TOUCH_ABOVE", threshold: 1_000_000n }); // SOL ≥ $1: already touched
  t = await accept(b, t);
  t = await fund(a, t);
  t = await fund(b, t);
  const beforeTouch = await usdcOf(a);
  const s1 = await runResolverTick(quiet);
  ok(s1.resolved.some((r) => r.betId === t.id && r.winner === "YES"), "resolver settles the touch bet YES immediately");
  const td = (await a.req<{ bet: BetDTO }>(`/api/bets/${t.id}`)).bet;
  ok(td.state === "SETTLED" && (await usdcOf(a)) - beforeTouch === 20n * USD, "justin paid the $20 pot");
  const settleEv = td.events?.find((e) => e.type === "SETTLED");
  ok(!!settleEv?.data?.source && !!td.resolvedValue, `price + source recorded (${settleEv?.data?.source}, ${td.resolvedValue})`);

  console.log("\n[resolver] at-deadline bet + expiry (waits ~70s)");
  let at = await createBet(a, alex, { deadlineSecs: 65, threshold: 1_000_000_000_000n }); // SOL ≥ $1M: NO
  at = await accept(b, at);
  at = await fund(a, at);
  at = await fund(b, at);
  const stale = await createBet(a, alex, { deadlineSecs: 65 }); // never answered
  const early = await runResolverTick(quiet);
  ok(!early.resolved.some((r) => r.betId === at.id), "AboveAt bet is not resolved before its deadline");
  const beforeAlex = await usdcOf(b);
  await new Promise((r) => setTimeout(r, 72_000));
  const s2 = await runResolverTick(quiet);
  ok(s2.resolved.some((r) => r.betId === at.id && r.winner === "NO"), "after the deadline it resolves NO");
  ok((await usdcOf(b)) - beforeAlex === 20n * USD, "alex paid the $20 pot");
  ok(s2.refunded.some((r) => r.betId === stale.id), "unanswered proposal gets expired");
  const sd = (await a.req<{ bet: BetDTO }>(`/api/bets/${stale.id}`)).bet;
  ok(sd.state === "EXPIRED", "stale bet is EXPIRED in the DB");

  return { oracleBet: bet };
}
