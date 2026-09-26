// Odds are a UI convenience — on-chain everything is just two stakes. Integer math only.
import { UNITS_PER_CENT } from "./money";

/** Round-half-up integer division for non-negative bigints. */
function divRound(a: bigint, b: bigint): bigint {
  return (a * 2n + b) / (2n * b);
}

/**
 * Opponent's stake given the creator's stake and American odds on the creator's side.
 *  +150, $10 → $15 (creator risks less, wins more)
 *  −200, $20 → $10 (creator is the favorite)
 * Result is rounded to the cent.
 */
export function opponentStakeFromOdds(creatorStake: bigint, american: number): bigint {
  if (!Number.isInteger(american) || Math.abs(american) < 100) {
    throw new Error("American odds must be an integer ≤ -100 or ≥ +100");
  }
  const cents = creatorStake / UNITS_PER_CENT;
  const x = BigInt(Math.abs(american));
  const oppCents = american > 0 ? divRound(cents * x, 100n) : divRound(cents * 100n, x);
  return oppCents * UNITS_PER_CENT;
}

/** American odds implied by two stakes (from the creator's point of view). */
export function americanFromStakes(creatorStake: bigint, opponentStake: bigint): number {
  if (creatorStake <= 0n || opponentStake <= 0n) return 100;
  return opponentStake >= creatorStake
    ? Number(divRound(opponentStake * 100n, creatorStake))
    : -Number(divRound(creatorStake * 100n, opponentStake));
}

/** Break-even probability for the side that risks `myStake` to win `theirStake` (0..1). */
export function impliedProbability(myStake: bigint, theirStake: bigint): number {
  const pot = myStake + theirStake;
  if (pot === 0n) return 0;
  return Number((myStake * 10_000n) / pot) / 10_000;
}

export function impliedProbabilityFromOdds(american: number): number {
  return american > 0 ? 100 / (american + 100) : -american / (-american + 100);
}

export function formatAmerican(american: number): string {
  return american > 0 ? `+${american}` : `${american}`;
}

export interface Payout {
  risk: bigint;
  toWin: bigint;
  pot: bigint;
  probability: number;
}

export function payoutFor(myStake: bigint, theirStake: bigint): Payout {
  return {
    risk: myStake,
    toWin: theirStake,
    pot: myStake + theirStake,
    probability: impliedProbability(myStake, theirStake),
  };
}
