// The editable bet form used by New Bet (filled by the AI parser or by hand).
import type { StakeValue } from "@/components/bet/stake-editor";
import type { DraftInput } from "./bet-schema";
import { priceToE6, UNITS_PER_USD, usdToUnits } from "./money";
import { opponentStakeFromOdds } from "./odds";
import type { ConditionStr, FeedStr, ResolutionStr } from "./solana/codec";

export interface DraftForm {
  opponentUsername: string;
  /** Open to anyone (price bets only) instead of a specific friend. */
  isPublic: boolean;
  title: string;
  conditionText: string;
  resolution: ResolutionStr;
  feed: FeedStr;
  kind: ConditionStr;
  thresholdUsd: string;
  deadline: Date;
  stake: StakeValue;
  clarifications: string[];
  confidence: number | null;
}

/** Output of POST /api/parse-bet (see lib/server/parse.ts). */
export interface ParsedBet {
  opponentUsername: string | null;
  title: string;
  conditionText: string;
  creatorSide: "YES" | "NO";
  creatorStakeUsd: number;
  opponentStakeUsd: number | null;
  oddsAmerican: number | null;
  resolution: ResolutionStr;
  oracle: { feed: FeedStr; kind: ConditionStr; threshold: number } | null;
  eventDeadlineISO: string;
  confidence: number;
  clarifications: string[];
}

export function emptyDraft(opponentUsername = ""): DraftForm {
  return {
    opponentUsername,
    isPublic: false,
    title: "",
    conditionText: "",
    resolution: "MUTUAL",
    feed: "SOL_USD",
    kind: "ABOVE_AT",
    thresholdUsd: "",
    deadline: new Date(Date.now() + 24 * 3600 * 1000),
    stake: { side: "YES", myStake: 10n * UNITS_PER_USD, theirStake: 10n * UNITS_PER_USD, mode: "even", odds: null },
    clarifications: [],
    confidence: null,
  };
}

export function draftFromParsed(p: ParsedBet, fallbackOpponent: string): DraftForm {
  const my = safeUnits(p.creatorStakeUsd) ?? 10n * UNITS_PER_USD;
  let theirs = my;
  let mode: StakeValue["mode"] = "even";
  if (p.oddsAmerican && Math.abs(p.oddsAmerican) >= 100) {
    theirs = opponentStakeFromOdds(my, Math.round(p.oddsAmerican));
    mode = "odds";
  } else if (p.opponentStakeUsd && p.opponentStakeUsd !== p.creatorStakeUsd) {
    theirs = safeUnits(p.opponentStakeUsd) ?? my;
    mode = "custom";
  }
  const deadline = new Date(p.eventDeadlineISO);
  return {
    opponentUsername: p.opponentUsername ?? fallbackOpponent,
    isPublic: false,
    title: p.title,
    conditionText: p.conditionText,
    resolution: p.resolution,
    feed: p.oracle?.feed ?? "SOL_USD",
    kind: p.oracle?.kind ?? "ABOVE_AT",
    thresholdUsd: p.oracle ? String(p.oracle.threshold) : "",
    deadline: isNaN(deadline.getTime()) ? new Date(Date.now() + 24 * 3600 * 1000) : deadline,
    stake: { side: p.creatorSide, myStake: my, theirStake: theirs, mode, odds: mode === "odds" ? Math.round(p.oddsAmerican!) : null },
    clarifications: p.clarifications,
    confidence: p.confidence,
  };
}

function safeUnits(usd: number | null): bigint | null {
  if (usd == null || !isFinite(usd) || usd <= 0) return null;
  try {
    return usdToUnits(usd);
  } catch {
    return null;
  }
}

export function toDraftInput(f: DraftForm): DraftInput {
  const threshold = Number(f.thresholdUsd.replace(/[$,\s]/g, ""));
  return {
    // Open bets are price-only; switching to "we agree" makes it a friend bet again.
    isPublic: false,
    opponentUsername: f.opponentUsername,
    title: f.title.trim(),
    conditionText: f.conditionText.trim(),
    creatorSide: f.stake.side,
    creatorStake: f.stake.myStake.toString(),
    opponentStake: f.stake.theirStake.toString(),
    oddsAmerican: f.stake.mode === "odds" ? f.stake.odds : null,
    resolution: f.resolution,
    oracle:
      f.resolution === "ORACLE"
        ? { feed: f.feed, kind: f.kind, threshold: (isFinite(threshold) && threshold > 0 ? priceToE6(threshold) : 0n).toString() }
        : null,
    eventDeadline: f.deadline.toISOString(),
  };
}

/** Date → value for <input type="datetime-local"> in local time. */
export function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
