import { describe, expect, it } from "vitest";
import { canonicalJson, termsJsonAndHash, type Terms } from "./terms";

const terms: Terms = {
  v: 1,
  title: "SOL hits $250",
  conditionText: "YES if SOL/USD ≥ $250",
  resolution: "ORACLE",
  oracle: { feed: "SOL_USD", kind: "TOUCH_ABOVE", threshold: "250000000" },
  creatorSide: "YES",
  creatorStake: "10000000",
  opponentStake: "50000000",
  eventDeadline: 1_800_000_000,
  creator: "A",
  opponent: "B",
};

describe("terms hash", () => {
  it("is independent of key order", () => {
    const shuffled = Object.fromEntries(Object.entries(terms).reverse()) as unknown as Terms;
    expect(canonicalJson(shuffled)).toBe(canonicalJson(terms));
    expect(termsJsonAndHash(shuffled).termsHash).toBe(termsJsonAndHash(terms).termsHash);
  });
  it("changes when any term changes", () => {
    const a = termsJsonAndHash(terms).termsHash;
    expect(termsJsonAndHash({ ...terms, opponentStake: "50000001" }).termsHash).not.toBe(a);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});
