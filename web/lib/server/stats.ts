import "server-only";
import type { Bet } from "@prisma/client";
import { prisma } from "../db";

export interface Record {
  wins: number;
  losses: number;
  /** base units; positive = up money */
  net: bigint;
}

type SettledBet = Pick<
  Bet,
  "creatorId" | "opponentId" | "creatorSide" | "creatorStake" | "opponentStake" | "winnerSide"
>;

/** From `userId`'s point of view: did they win this settled bet, and by how much. */
export function resultFor(bet: SettledBet, userId: string): { won: boolean; delta: bigint } | null {
  if (!bet.winnerSide) return null;
  const isCreator = bet.creatorId === userId;
  if (!isCreator && bet.opponentId !== userId) return null;
  const mySide = isCreator ? bet.creatorSide : bet.creatorSide === "YES" ? "NO" : "YES";
  const won = bet.winnerSide === mySide;
  const myStake = isCreator ? bet.creatorStake : bet.opponentStake;
  const theirStake = isCreator ? bet.opponentStake : bet.creatorStake;
  return { won, delta: won ? theirStake : -myStake };
}

function tally(bets: SettledBet[], userId: string): Record {
  const rec: Record = { wins: 0, losses: 0, net: 0n };
  for (const b of bets) {
    const r = resultFor(b, userId);
    if (!r) continue;
    if (r.won) rec.wins++;
    else rec.losses++;
    rec.net += r.delta;
  }
  return rec;
}

export async function settledBetsOf(userId: string) {
  return prisma.bet.findMany({
    where: { state: "SETTLED", OR: [{ creatorId: userId }, { opponentId: userId }] },
  });
}

export async function recordOf(userId: string): Promise<Record> {
  return tally(await settledBetsOf(userId), userId);
}

/** Record of `userId` against each opponent, keyed by opponent user id. */
export async function headToHead(userId: string): Promise<Map<string, Record>> {
  const bets = await settledBetsOf(userId);
  const byOpp = new Map<string, SettledBet[]>();
  for (const b of bets) {
    const other = b.creatorId === userId ? b.opponentId : b.creatorId;
    if (!other) continue;
    byOpp.set(other, [...(byOpp.get(other) ?? []), b]);
  }
  return new Map([...byOpp].map(([id, list]) => [id, tally(list, userId)]));
}
