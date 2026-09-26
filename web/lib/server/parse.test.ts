import { describe, expect, it } from "vitest";
import { heuristicParse, type ParseContext } from "./parse";

const ctx = (text: string): ParseContext => ({
  text,
  now: new Date("2026-09-26T15:00:00Z"),
  timezone: "America/Toronto",
  prices: null,
  friends: [{ username: "alex", displayName: "Alex" }],
});

describe("heuristicParse (offline fallback)", () => {
  it("price bet with relative deadline", () => {
    const p = heuristicParse(ctx("I bet @alex $10 SOL is above $250 in 3 minutes"));
    expect(p.opponentUsername).toBe("alex");
    expect(p.creatorStakeUsd).toBe(10);
    expect(p.resolution).toBe("ORACLE");
    expect(p.oracle).toEqual({ feed: "SOL_USD", kind: "ABOVE_AT", threshold: 250 });
    expect(new Date(p.eventDeadlineISO).getTime()).toBe(Date.parse("2026-09-26T15:03:00Z"));
  });
  it("'hits … before midnight' is a touch bet ending 11:59 PM local", () => {
    const p = heuristicParse(ctx("I bet Alex $20 BTC hits $100,000 before midnight"));
    expect(p.oracle?.kind).toBe("TOUCH_ABOVE");
    expect(p.oracle?.threshold).toBe(100_000);
    expect(p.eventDeadlineISO).toBe(new Date("2026-09-26T23:59:00-04:00").toISOString());
  });
  it("non-price bets are mutual", () => {
    const p = heuristicParse(ctx("$20 says @alex can't run a 5K under 25 minutes this week"));
    expect(p.resolution).toBe("MUTUAL");
    expect(p.oracle).toBeNull();
  });
  it("unknown opponent gets a clarification", () => {
    const p = heuristicParse(ctx("I bet @zed $5 ETH drops to $2000 tomorrow"));
    expect(p.opponentUsername).toBeNull();
    expect(p.clarifications.join(" ")).toMatch(/zed/);
    expect(p.oracle?.kind).toBe("TOUCH_BELOW");
  });
});
