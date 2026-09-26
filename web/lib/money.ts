// Money is always bigint base units of a 6-decimal token (USDC). Never floats for on-chain values.
export const USDC_DECIMALS = 6;
export const UNITS_PER_USD = 1_000_000n;
export const UNITS_PER_CENT = 10_000n;

/** "12.345" | 12.34 → base units, rounded to the cent. Throws on garbage. */
export function usdToUnits(value: string | number): bigint {
  const s = (typeof value === "number" ? value.toFixed(2) : value).trim().replace(/[$,\s]/g, "");
  const m = s.match(/^(\d*)(?:\.(\d*))?$/);
  if (!m || (m[1] === "" && (m[2] ?? "") === "")) throw new Error(`Invalid amount: ${value}`);
  const whole = BigInt(m[1] || "0");
  const frac = (m[2] ?? "").padEnd(3, "0");
  // cents + rounding by the third decimal
  let cents = whole * 100n + BigInt(frac.slice(0, 2));
  if (Number(frac[2]) >= 5) cents += 1n;
  return cents * UNITS_PER_CENT;
}

export function unitsToCents(units: bigint): bigint {
  return (units + UNITS_PER_CENT / 2n) / UNITS_PER_CENT;
}

export function toBig(v: bigint | string | number): bigint {
  return typeof v === "bigint" ? v : BigInt(v);
}

/** 12_340_000n → "$12.34", 10_000_000n → "$10" */
export function formatUsd(units: bigint | string | number, opts: { sign?: boolean } = {}): string {
  const u = toBig(units);
  const neg = u < 0n;
  const cents = unitsToCents(neg ? -u : u);
  const whole = cents / 100n;
  const rem = cents % 100n;
  const body = `$${whole.toLocaleString("en-US")}${rem ? `.${rem.toString().padStart(2, "0")}` : ""}`;
  if (neg) return `−${body}`;
  return opts.sign && u > 0n ? `+${body}` : body;
}

/** Oracle price (USD * 1e6) → "$251.32" */
export function formatPrice(e6: bigint | string | number): string {
  const v = toBig(e6);
  const cents = (v + 5_000n) / 10_000n;
  const whole = cents / 100n;
  return `$${whole.toLocaleString("en-US")}.${(cents % 100n).toString().padStart(2, "0")}`;
}

export function priceToE6(usd: number): bigint {
  return BigInt(Math.round(usd * 100)) * 10_000n;
}

export function unitsToNumber(units: bigint | string): number {
  return Number(toBig(units)) / 1e6;
}
