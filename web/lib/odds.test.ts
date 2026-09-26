import { describe, expect, it } from "vitest";
import { UNITS_PER_USD, formatUsd, formatPrice, usdToUnits } from "./money";
import {
  americanFromStakes,
  impliedProbability,
  impliedProbabilityFromOdds,
  opponentStakeFromOdds,
  payoutFor,
} from "./odds";

const usd = (n: number) => BigInt(Math.round(n * 100)) * 10_000n;

describe("opponentStakeFromOdds", () => {
  it("positive odds: +150 on $10 → opponent puts in $15", () => {
    expect(opponentStakeFromOdds(usd(10), 150)).toBe(usd(15));
  });
  it("negative odds: −200 on $20 → opponent puts in $10", () => {
    expect(opponentStakeFromOdds(usd(20), -200)).toBe(usd(10));
  });
  it("even money", () => {
    expect(opponentStakeFromOdds(usd(10), 100)).toBe(usd(10));
    expect(opponentStakeFromOdds(usd(10), -100)).toBe(usd(10));
  });
  it("rounds to the cent", () => {
    // $10 at −300 → $3.333… → $3.33
    expect(opponentStakeFromOdds(usd(10), -300)).toBe(usd(3.33));
    // $3.33 at +150 → $4.995 → $5.00 (half-up)
    expect(opponentStakeFromOdds(usd(3.33), 150)).toBe(usd(5));
  });
  it("rejects nonsense odds", () => {
    expect(() => opponentStakeFromOdds(usd(10), 50)).toThrow();
    expect(() => opponentStakeFromOdds(usd(10), 1.5)).toThrow();
  });
});

describe("payout + probability", () => {
  it("+150 on $10: risk $10 to win $15, pot $25, implied 40%", () => {
    const p = payoutFor(usd(10), usd(15));
    expect(p).toMatchObject({ risk: usd(10), toWin: usd(15), pot: usd(25) });
    expect(p.probability).toBeCloseTo(0.4);
    expect(impliedProbabilityFromOdds(150)).toBeCloseTo(0.4);
  });
  it("−200 favorite is 66.7%", () => {
    expect(impliedProbabilityFromOdds(-200)).toBeCloseTo(2 / 3);
    expect(impliedProbability(usd(20), usd(10))).toBeCloseTo(0.6667, 3);
  });
  it("round-trips stakes → American odds", () => {
    expect(americanFromStakes(usd(10), usd(15))).toBe(150);
    expect(americanFromStakes(usd(20), usd(10))).toBe(-200);
    expect(americanFromStakes(usd(10), usd(50))).toBe(500);
  });
  it("asymmetric demo stakes: $10 vs $50 → winner gets $60", () => {
    expect(payoutFor(usd(10), usd(50)).pot).toBe(60n * UNITS_PER_USD);
  });
});

describe("money", () => {
  it("parses dollars to 6-decimal units with integer math", () => {
    expect(usdToUnits("10")).toBe(10_000_000n);
    expect(usdToUnits("$1,234.56")).toBe(1_234_560_000n);
    expect(usdToUnits("0.105")).toBe(110_000n); // rounds half-up to the cent
    expect(usdToUnits(12.34)).toBe(12_340_000n);
    expect(() => usdToUnits("abc")).toThrow();
  });
  it("formats", () => {
    expect(formatUsd(10_000_000n)).toBe("$10");
    expect(formatUsd(12_340_000n)).toBe("$12.34");
    expect(formatUsd(-5_000_000n)).toBe("−$5");
    expect(formatUsd(5_000_000n, { sign: true })).toBe("+$5");
    expect(formatPrice(251_320_000n)).toBe("$251.32");
  });
});
