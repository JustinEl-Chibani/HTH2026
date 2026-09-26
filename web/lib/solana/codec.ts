// Converts between Anchor's decoded enums ({ yes: {} }) and the app's string enums.
import type { BN } from "@anchor-lang/core";
import type { PublicKey } from "@solana/web3.js";

export type SideStr = "YES" | "NO";
export type OutcomeStr = "YES" | "NO" | "VOID";
export type ResolutionStr = "ORACLE" | "MUTUAL";
export type FeedStr = "SOL_USD" | "BTC_USD" | "ETH_USD";
export type ConditionStr = "TOUCH_ABOVE" | "TOUCH_BELOW" | "ABOVE_AT" | "BELOW_AT";
export type BetStateStr =
  | "DRAFT"
  | "PROPOSED"
  | "ACCEPTED"
  | "ACTIVE"
  | "AWAITING_CONFIRMATION"
  | "SETTLED"
  | "CANCELLED"
  | "EXPIRED"
  | "VOID";

export const TERMINAL_STATES: BetStateStr[] = ["SETTLED", "CANCELLED", "EXPIRED", "VOID"];

export interface OracleTerms {
  feed: FeedStr;
  kind: ConditionStr;
  /** USD price * 1e6 (integer) */
  threshold: bigint;
}

// Anchor enum objects look like { someVariant: {} }.
type AnchorEnum = Record<string, unknown>;
const variant = (e: unknown): string => Object.keys(e as AnchorEnum)[0];

const SIDE: Record<string, SideStr> = { yes: "YES", no: "NO" };
const OUTCOME: Record<string, OutcomeStr> = { yes: "YES", no: "NO", void: "VOID" };
const RESOLUTION: Record<string, ResolutionStr> = { oracle: "ORACLE", mutual: "MUTUAL" };
const FEED: Record<string, FeedStr> = { solUsd: "SOL_USD", btcUsd: "BTC_USD", ethUsd: "ETH_USD" };
const CONDITION: Record<string, ConditionStr> = {
  touchAbove: "TOUCH_ABOVE",
  touchBelow: "TOUCH_BELOW",
  aboveAt: "ABOVE_AT",
  belowAt: "BELOW_AT",
};
const STATE: Record<string, BetStateStr> = {
  proposed: "PROPOSED",
  accepted: "ACCEPTED",
  active: "ACTIVE",
  awaitingConfirmation: "AWAITING_CONFIRMATION",
  settled: "SETTLED",
  cancelled: "CANCELLED",
  expired: "EXPIRED",
  void: "VOID",
};

function invert<T extends string>(m: Record<string, T>): Record<T, AnchorEnum> {
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [v, { [k]: {} }])) as Record<
    T,
    AnchorEnum
  >;
}
const SIDE_TO = invert(SIDE);
const OUTCOME_TO = invert(OUTCOME);
const RESOLUTION_TO = invert(RESOLUTION);
const FEED_TO = invert(FEED);
const CONDITION_TO = invert(CONDITION);

// Anchor's generated types for enum args are unions of these object shapes; the `never` casts below
// let callers pass our encoded objects straight into `program.methods.*`.
export const enc = {
  side: (s: SideStr) => SIDE_TO[s] as never,
  outcome: (o: OutcomeStr) => OUTCOME_TO[o] as never,
  resolution: (r: ResolutionStr) => RESOLUTION_TO[r] as never,
  oracle: (o: OracleTerms | null, bn: (v: bigint) => BN) =>
    (o
      ? { feed: FEED_TO[o.feed], kind: CONDITION_TO[o.kind], threshold: bn(o.threshold) }
      : null) as never,
};

export const dec = {
  side: (e: unknown) => SIDE[variant(e)],
  outcome: (e: unknown) => OUTCOME[variant(e)],
  resolution: (e: unknown) => RESOLUTION[variant(e)],
  feed: (e: unknown) => FEED[variant(e)],
  condition: (e: unknown) => CONDITION[variant(e)],
  state: (e: unknown) => STATE[variant(e)],
};

/** Raw account as decoded by Anchor (camelCase fields). */
export interface RawBetAccount {
  betId: BN;
  creator: PublicKey;
  opponent: PublicKey;
  creatorSide: unknown;
  creatorStake: BN;
  opponentStake: BN;
  version: number;
  lastProposer: PublicKey;
  termsHash: number[];
  resolution: unknown;
  oracle: { feed: unknown; kind: unknown; threshold: BN } | null;
  createdAt: BN;
  acceptDeadline: BN;
  fundingDeadline: BN;
  eventDeadline: BN;
  resolveDeadline: BN;
  state: unknown;
  creatorFunded: boolean;
  opponentFunded: boolean;
  proposedOutcome: unknown | null;
  proposedBy: PublicKey | null;
  winner: unknown | null;
  resolvedValue: BN | null;
  settledAt: BN;
}

/** Plain, serializable view of an on-chain Bet. */
export interface ChainBet {
  betId: bigint;
  creator: string;
  opponent: string;
  creatorSide: SideStr;
  creatorStake: bigint;
  opponentStake: bigint;
  version: number;
  lastProposer: string;
  termsHash: string; // hex
  resolution: ResolutionStr;
  oracle: OracleTerms | null;
  createdAt: number; // unix seconds
  acceptDeadline: number;
  fundingDeadline: number;
  eventDeadline: number;
  resolveDeadline: number;
  state: BetStateStr;
  creatorFunded: boolean;
  opponentFunded: boolean;
  proposedOutcome: OutcomeStr | null;
  proposedBy: string | null;
  winner: SideStr | null;
  resolvedValue: bigint | null;
  settledAt: number;
}

const big = (b: BN) => BigInt(b.toString());
const num = (b: BN) => Number(b.toString());

export function toHex(bytes: Uint8Array | number[]): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function hexToBytes(hex: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < hex.length; i += 2) out.push(parseInt(hex.slice(i, i + 2), 16));
  return out;
}

export function decodeBet(raw: RawBetAccount): ChainBet {
  return {
    betId: big(raw.betId),
    creator: raw.creator.toBase58(),
    opponent: raw.opponent.toBase58(),
    creatorSide: dec.side(raw.creatorSide),
    creatorStake: big(raw.creatorStake),
    opponentStake: big(raw.opponentStake),
    version: raw.version,
    lastProposer: raw.lastProposer.toBase58(),
    termsHash: toHex(raw.termsHash),
    resolution: dec.resolution(raw.resolution),
    oracle: raw.oracle
      ? {
          feed: dec.feed(raw.oracle.feed),
          kind: dec.condition(raw.oracle.kind),
          threshold: big(raw.oracle.threshold),
        }
      : null,
    createdAt: num(raw.createdAt),
    acceptDeadline: num(raw.acceptDeadline),
    fundingDeadline: num(raw.fundingDeadline),
    eventDeadline: num(raw.eventDeadline),
    resolveDeadline: num(raw.resolveDeadline),
    state: dec.state(raw.state),
    creatorFunded: raw.creatorFunded,
    opponentFunded: raw.opponentFunded,
    proposedOutcome: raw.proposedOutcome ? dec.outcome(raw.proposedOutcome) : null,
    proposedBy: raw.proposedBy ? raw.proposedBy.toBase58() : null,
    winner: raw.winner ? dec.side(raw.winner) : null,
    resolvedValue: raw.resolvedValue ? big(raw.resolvedValue) : null,
    settledAt: num(raw.settledAt),
  };
}

/** Whether `value` (price * 1e6) satisfies the YES condition — mirrors OracleCondition::is_yes. */
export function oracleIsYes(oracle: OracleTerms, value: bigint): boolean {
  return oracle.kind === "TOUCH_ABOVE" || oracle.kind === "ABOVE_AT"
    ? value >= oracle.threshold
    : value <= oracle.threshold;
}

export function isTouch(kind: ConditionStr): boolean {
  return kind === "TOUCH_ABOVE" || kind === "TOUCH_BELOW";
}
