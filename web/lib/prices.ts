// Spot prices for SOL/BTC/ETH. Primary: Pyth Hermes (needs PYTH_API_KEY since Aug 2026);
// fallbacks: Kraken public ticker, then CoinGecko (keyless tier rate-limits quickly).
// Prices are integers in USD * 1e6. Relative imports only (used by the resolver).
import type { FeedStr } from "./solana/codec";

export interface PricePoint {
  /** USD * 1e6 */
  price: bigint;
  source: PriceSource;
  /** unix seconds the source published this price */
  publishTime: number;
}

export type PriceSource = "pyth" | "kraken" | "coingecko";

export const SOURCE_LABEL: Record<PriceSource, string> = { pyth: "Pyth", kraken: "Kraken", coingecko: "CoinGecko" };

export type PriceMap = Record<FeedStr, PricePoint>;

export const PYTH_FEED_IDS: Record<FeedStr, string> = {
  SOL_USD: "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
  BTC_USD: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  ETH_USD: "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
};

const COINGECKO_IDS: Record<FeedStr, string> = { SOL_USD: "solana", BTC_USD: "bitcoin", ETH_USD: "ethereum" };
const FEEDS = Object.keys(PYTH_FEED_IDS) as FeedStr[];

function scaleToE6(price: string, expo: number): bigint {
  const p = BigInt(price);
  const shift = expo + 6;
  return shift >= 0 ? p * 10n ** BigInt(shift) : p / 10n ** BigInt(-shift);
}

async function fetchJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  const res = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(5_000) });
  if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}`);
  return res.json();
}

export async function fetchPythPrices(): Promise<PriceMap> {
  const key = process.env.PYTH_API_KEY;
  if (!key) throw new Error("PYTH_API_KEY not set");
  const base = process.env.PYTH_HERMES_URL || "https://hermes.pyth.network";
  const qs = FEEDS.map((f) => `ids[]=${PYTH_FEED_IDS[f]}`).join("&");
  const data = (await fetchJson(`${base}/v2/updates/price/latest?${qs}&parsed=true`, {
    Authorization: `Bearer ${key}`,
  })) as { parsed: { id: string; price: { price: string; expo: number; publish_time: number } }[] };
  const out = {} as PriceMap;
  for (const f of FEEDS) {
    const p = data.parsed.find((x) => x.id.replace(/^0x/, "") === PYTH_FEED_IDS[f]);
    if (!p) throw new Error(`Pyth missing ${f}`);
    out[f] = { price: scaleToE6(p.price.price, p.price.expo), source: "pyth", publishTime: p.price.publish_time };
  }
  return out;
}

export async function fetchCoinGeckoPrices(): Promise<PriceMap> {
  const ids = FEEDS.map((f) => COINGECKO_IDS[f]).join(",");
  const data = (await fetchJson(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_last_updated_at=true`,
  )) as Record<string, { usd: number; last_updated_at?: number }>;
  const out = {} as PriceMap;
  for (const f of FEEDS) {
    const row = data[COINGECKO_IDS[f]];
    if (!row) throw new Error(`CoinGecko missing ${f}`);
    // Round to the cent via string math to avoid float drift in the stored integer.
    out[f] = {
      price: BigInt(Math.round(row.usd * 100)) * 10_000n,
      source: "coingecko",
      publishTime: row.last_updated_at ?? Math.floor(Date.now() / 1000),
    };
  }
  return out;
}

const KRAKEN_PAIRS: Record<FeedStr, string> = { SOL_USD: "SOLUSD", BTC_USD: "XXBTZUSD", ETH_USD: "XETHZUSD" };

export async function fetchKrakenPrices(): Promise<PriceMap> {
  const data = (await fetchJson("https://api.kraken.com/0/public/Ticker?pair=SOLUSD,XBTUSD,ETHUSD")) as {
    error: string[];
    result: Record<string, { c: [string, string] }>;
  };
  if (data.error?.length) throw new Error(`Kraken: ${data.error.join(", ")}`);
  const now = Math.floor(Date.now() / 1000);
  const out = {} as PriceMap;
  for (const f of FEEDS) {
    const last = data.result[KRAKEN_PAIRS[f]]?.c?.[0];
    if (!last) throw new Error(`Kraken missing ${f}`);
    out[f] = { price: decimalToE6(last), source: "kraken", publishTime: now };
  }
  return out;
}

/** "120.4567" → 120456700n (truncates past 6 decimals, no floats). */
function decimalToE6(s: string): bigint {
  const [w, frac = ""] = s.split(".");
  return BigInt(w) * 1_000_000n + BigInt((frac + "000000").slice(0, 6));
}

let cache: { at: number; prices: PriceMap } | null = null;

const SOURCES = [fetchPythPrices, fetchKrakenPrices, fetchCoinGeckoPrices];

/** Latest prices (cached briefly). Tries Pyth, then Kraken, then CoinGecko; serves stale if all fail. */
export async function getPrices(maxAgeMs = 3_000): Promise<PriceMap> {
  if (cache && Date.now() - cache.at < maxAgeMs) return cache.prices;
  let lastErr: unknown;
  for (const source of SOURCES) {
    try {
      const prices = await source();
      cache = { at: Date.now(), prices };
      return prices;
    } catch (e) {
      lastErr = e;
    }
  }
  if (cache && Date.now() - cache.at < 120_000) return cache.prices; // stale beats nothing
  throw lastErr;
}
