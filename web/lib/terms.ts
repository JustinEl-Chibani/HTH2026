// Canonical, hashable bet terms. The sha256 of this JSON is stored on-chain as `terms_hash`, so the
// human-readable text can't be silently changed after someone agrees to it. Isomorphic (browser + node).
import { sha256 } from "@noble/hashes/sha2";
import type { ConditionStr, FeedStr, ResolutionStr, SideStr } from "./solana/codec";

export interface Terms {
  v: 1;
  title: string;
  conditionText: string;
  resolution: ResolutionStr;
  oracle: { feed: FeedStr; kind: ConditionStr; threshold: string } | null;
  creatorSide: SideStr;
  creatorStake: string; // base units
  opponentStake: string;
  eventDeadline: number; // unix seconds
  creator: string; // wallet
  opponent: string;
}

/** JSON.stringify with recursively sorted keys — same object, same bytes, same hash. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
    .join(",")}}`;
}

export function hashJson(json: string): string {
  return Array.from(sha256(new TextEncoder().encode(json)), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function termsJsonAndHash(terms: Terms): { termsJson: string; termsHash: string } {
  const termsJson = canonicalJson(terms);
  return { termsJson, termsHash: hashJson(termsJson) };
}
