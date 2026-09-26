import "server-only";
import type { Bet, BetEvent, BetVersion, User } from "@prisma/client";
import { PublicKey } from "@solana/web3.js";
import { randomInt } from "node:crypto";
import { prisma } from "../db";
import type { DraftInput } from "../bet-schema";
import type { BetDTO } from "../bet-types";
import type { BetStateStr, OutcomeStr, ResolutionStr, SideStr } from "../solana/codec";
import { betPda, vaultPda } from "../solana/program";
import { termsJsonAndHash } from "../terms";
import { badRequest, notFound } from "./api";
import { areFriends, publicUser } from "./users";

const ACCEPT_WINDOW_SECS = 24 * 60 * 60;
const MIN_LEAD_SECS = 60;

type FullBet = Bet & {
  creator: User;
  opponent: User | null;
  versions?: BetVersion[];
  events?: BetEvent[];
};

export function toDto(b: FullBet): BetDTO {
  const final = b.events?.filter((e) => ["SETTLED", "VOID", "EXPIRED", "CANCELLED"].includes(e.type)).at(-1);
  return {
    id: b.id,
    onchainBetId: b.onchainBetId.toString(),
    betPda: b.betPda,
    vaultPda: vaultPda(new PublicKey(b.betPda)).toBase58(),
    title: b.title,
    conditionText: b.conditionText,
    termsJson: b.termsJson,
    resolutionKind: b.resolutionKind as ResolutionStr,
    oracle: b.oracleJson ? JSON.parse(b.oracleJson) : null,
    creatorSide: b.creatorSide as SideStr,
    creatorStake: b.creatorStake.toString(),
    opponentStake: b.opponentStake.toString(),
    oddsAmerican: b.oddsAmerican,
    version: b.version,
    state: b.state as BetStateStr,
    creatorFunded: b.creatorFunded,
    opponentFunded: b.opponentFunded,
    acceptDeadline: b.acceptDeadline?.toISOString() ?? null,
    fundingDeadline: b.fundingDeadline?.toISOString() ?? null,
    eventDeadline: b.eventDeadline.toISOString(),
    resolveDeadline: b.resolveDeadline?.toISOString() ?? null,
    proposedWinner: b.proposedWinner as OutcomeStr | null,
    proposedById: b.proposedById,
    winnerSide: b.winnerSide as SideStr | null,
    resolvedValue: b.resolvedValue?.toString() ?? null,
    lastProposerId: b.lastProposerId,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
    creator: publicUser(b.creator),
    opponent: b.opponent ? publicUser(b.opponent) : null,
    versions: b.versions?.map((v) => ({
      version: v.version,
      proposerId: v.proposerId,
      creatorStake: v.creatorStake.toString(),
      opponentStake: v.opponentStake.toString(),
      creatorSide: v.creatorSide as SideStr,
      txSig: v.txSig,
      createdAt: v.createdAt.toISOString(),
    })),
    events: b.events?.map((e) => ({
      id: e.id,
      type: e.type,
      actorId: e.actorId,
      txSig: e.txSig,
      data: e.data ? JSON.parse(e.data) : null,
      createdAt: e.createdAt.toISOString(),
    })),
    finalTxSig: final?.txSig ?? null,
  };
}

export async function getBetDetail(id: string): Promise<BetDTO> {
  const bet = await prisma.bet.findUnique({
    where: { id },
    include: {
      creator: true,
      opponent: true,
      versions: { orderBy: { version: "asc" } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!bet || bet.state === "DRAFT") throw notFound("Bet not found");
  return toDto(bet);
}

/** Random u64 bet id (kept under 2^53 so it round-trips through JSON numbers too). */
function newOnchainId(): bigint {
  return BigInt(Date.now()) * 1000n + BigInt(randomInt(1000));
}

export async function createDraft(me: User & { username: string }, d: DraftInput) {
  const opponent = await prisma.user.findUnique({ where: { username: d.opponentUsername } });
  if (!opponent) throw notFound(`No one called @${d.opponentUsername}`);
  if (opponent.id === me.id) throw badRequest("You can't bet against yourself");
  if (!(await areFriends(me.id, opponent.id))) {
    throw badRequest(`Add @${opponent.username} as a friend first`);
  }

  const nowSecs = Math.floor(Date.now() / 1000);
  const eventDeadline = Math.floor(new Date(d.eventDeadline).getTime() / 1000);
  if (eventDeadline < nowSecs + MIN_LEAD_SECS) throw badRequest("The deadline needs to be at least a minute away");
  const acceptDeadline = Math.min(eventDeadline, nowSecs + ACCEPT_WINDOW_SECS);

  const onchainBetId = newOnchainId();
  const pda = betPda(new PublicKey(me.wallet), onchainBetId).toBase58();
  const { termsJson, termsHash } = termsJsonAndHash({
    v: 1,
    title: d.title,
    conditionText: d.conditionText,
    resolution: d.resolution,
    oracle: d.oracle,
    creatorSide: d.creatorSide,
    creatorStake: d.creatorStake,
    opponentStake: d.opponentStake,
    eventDeadline,
    creator: me.wallet,
    opponent: opponent.wallet,
  });

  const bet = await prisma.bet.create({
    data: {
      onchainBetId,
      betPda: pda,
      creatorId: me.id,
      opponentId: opponent.id,
      title: d.title,
      conditionText: d.conditionText,
      termsJson,
      termsHash,
      resolutionKind: d.resolution,
      oracleJson: d.oracle ? JSON.stringify(d.oracle) : null,
      creatorSide: d.creatorSide,
      creatorStake: BigInt(d.creatorStake),
      opponentStake: BigInt(d.opponentStake),
      oddsAmerican: d.oddsAmerican ?? null,
      state: "DRAFT",
      acceptDeadline: new Date(acceptDeadline * 1000),
      eventDeadline: new Date(eventDeadline * 1000),
    },
    include: { creator: true, opponent: true },
  });
  return {
    bet: toDto(bet),
    chain: {
      betId: onchainBetId.toString(),
      betPda: pda,
      termsHash,
      acceptDeadline,
      eventDeadline,
      opponentWallet: opponent.wallet,
    },
  };
}
