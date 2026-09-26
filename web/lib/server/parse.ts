import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { ParsedBet } from "../draft";
import { formatPrice } from "../money";
import type { PriceMap } from "../prices";
import { ApiError } from "./api";
import { serverEnv } from "./env";

export interface ParseContext {
  text: string;
  now: Date;
  timezone: string;
  prices: PriceMap | null;
  friends: { username: string; displayName: string | null }[];
}

// What the model must return. Constraints like min/max are validated client-side by the SDK.
const ParsedBetSchema = z.object({
  opponentUsername: z.string().nullable().describe("Exact username from the friends list, or null"),
  title: z.string().describe('Short, punchy title, e.g. "SOL hits $250 by midnight"'),
  conditionText: z.string().describe("Precise, unambiguous statement of exactly what makes YES win"),
  creatorSide: z.enum(["YES", "NO"]).describe("The side the author of the message is taking"),
  creatorStakeUsd: z.number().describe("Dollars the author risks"),
  opponentStakeUsd: z.number().nullable().describe("Dollars the opponent risks; null means even money"),
  oddsAmerican: z.number().nullable().describe("American odds on the author's side if stated (e.g. 150 or -200), else null"),
  resolution: z.enum(["ORACLE", "MUTUAL"]),
  oracle: z
    .object({
      feed: z.enum(["SOL_USD", "BTC_USD", "ETH_USD"]),
      kind: z.enum(["TOUCH_ABOVE", "TOUCH_BELOW", "ABOVE_AT", "BELOW_AT"]),
      threshold: z.number().describe("USD price"),
    })
    .nullable(),
  eventDeadlineISO: z.string().describe("ISO 8601 with the user's UTC offset, e.g. 2026-09-26T23:59:00-04:00"),
  confidence: z.number().describe("0 to 1"),
  clarifications: z.array(z.string()).describe("Short notes on anything the user should double-check"),
});

const SYSTEM = `You turn casual bets between friends into precise, structured bet terms for an app called PutYourMoney.

The author of the message is always the "creator". Figure out who they're betting against, which side they're on, how much each side puts in, how the bet is decided, and when.

Rules:
- Resolution: crypto price claims about SOL, BTC or ETH are ORACLE (settled automatically from a price feed). Everything else — sports, fitness, cooking, anything subjective or real-world — is MUTUAL (both people confirm the result). Sports results are MUTUAL.
- Oracle kinds: "hits", "reaches", "touches", "breaks" a price before a time → TOUCH_ABOVE (or TOUCH_BELOW for "drops to", "falls to"). "Is above/below X at/by/in <time>" or "closes above" → ABOVE_AT / BELOW_AT, evaluated once at the deadline.
- Frame YES as the claim being made. If the author says the claim will happen, creatorSide is YES. If they bet it won't happen ("I bet you SOL doesn't hit $250"), keep YES as "SOL hits $250" and set creatorSide to NO. For "X can't do Y" phrasing, YES is the positive statement ("X does Y") and the author is NO.
- Stakes: "$10" alone means both sides put in $10 (opponentStakeUsd null). "My $10 against your $50" → 10 and 50. "+150 odds" → oddsAmerican 150 on the author's side, opponentStakeUsd null.
- Times are in the user's timezone. "Midnight"/"tonight" means 11:59 PM today (tomorrow if that already passed). "Tomorrow" without a time means 8:00 PM tomorrow. "This week" means Sunday 11:59 PM. "In N minutes/hours" is relative to now. Always include the UTC offset in eventDeadlineISO.
- Opponent: match names, nicknames and @handles against the friends list (case-insensitive, fuzzy) and return that friend's exact username. If nobody matches, return null and add a clarification.
- conditionText must be specific enough that two friends couldn't argue about it: include the asset, price, comparison, time and timezone, or the exact real-world criterion.
- Add clarifications for anything you had to assume (defaulted times, guessed opponent, ambiguous side). Lower confidence when you guess.`;

function tzOffset(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" }).formatToParts(date);
  const raw = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = raw.match(/GMT([+-]\d{2}):?(\d{2})?/);
  return m ? `${m[1]}:${m[2] ?? "00"}` : "+00:00";
}

function localNow(ctx: ParseContext): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: ctx.timezone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return `${fmt.format(ctx.now)} (${ctx.timezone}, UTC${tzOffset(ctx.now, ctx.timezone)})`;
}

function contextBlock(ctx: ParseContext): string {
  const prices = ctx.prices
    ? Object.entries(ctx.prices)
        .map(([k, v]) => `${k.replace("_", "/")}: ${formatPrice(v.price)}`)
        .join(", ")
    : "unavailable";
  const friends = ctx.friends.length
    ? ctx.friends.map((f) => `- ${f.username}${f.displayName ? ` (${f.displayName})` : ""}`).join("\n")
    : "(no friends yet)";
  return `Current time: ${localNow(ctx)}\nCurrent prices: ${prices}\nFriends:\n${friends}`;
}

/** Keep whatever the model (or heuristic) returned inside the app's rules. */
export function normalize(p: ParsedBet, ctx: ParseContext): ParsedBet {
  const notes = [...p.clarifications];
  let opponent = p.opponentUsername;
  if (opponent) {
    const want = opponent.toLowerCase().replace(/^@/, "");
    const hit =
      ctx.friends.find((f) => f.username === want) ??
      ctx.friends.find((f) => f.displayName?.toLowerCase() === want) ??
      ctx.friends.find((f) => f.username.startsWith(want) || f.displayName?.toLowerCase().startsWith(want));
    opponent = hit?.username ?? null;
    if (!hit) notes.push(`Couldn't find "${p.opponentUsername}" in your friends — pick an opponent.`);
  }
  let deadline = new Date(p.eventDeadlineISO);
  if (isNaN(deadline.getTime()) || deadline.getTime() < ctx.now.getTime() + 60_000) {
    deadline = new Date(ctx.now.getTime() + 60 * 60_000);
    notes.push("Couldn't work out a future deadline — set to 1 hour from now.");
  }
  const oracle = p.resolution === "ORACLE" ? p.oracle : null;
  const resolution = p.resolution === "ORACLE" && !oracle ? "MUTUAL" : p.resolution;
  const stake = Math.min(Math.max(p.creatorStakeUsd || 10, 0.01), 10_000);
  return {
    ...p,
    opponentUsername: opponent,
    title: p.title.slice(0, 80),
    conditionText: p.conditionText.slice(0, 500),
    creatorStakeUsd: stake,
    opponentStakeUsd: p.opponentStakeUsd && p.opponentStakeUsd > 0 ? Math.min(p.opponentStakeUsd, 10_000) : null,
    oddsAmerican: p.oddsAmerican && Math.abs(p.oddsAmerican) >= 100 ? Math.round(p.oddsAmerican) : null,
    resolution,
    oracle,
    eventDeadlineISO: deadline.toISOString(),
    confidence: Math.min(Math.max(p.confidence, 0), 1),
    clarifications: [...new Set(notes)].slice(0, 5),
  };
}

let client: Anthropic | null = null;

export async function parseWithClaude(ctx: ParseContext): Promise<ParsedBet> {
  const env = serverEnv();
  if (!env.ANTHROPIC_API_KEY) throw new ApiError(503, "AI parsing isn't configured", "AI_UNAVAILABLE");
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 20_000, maxRetries: 1 });

  const response = await client.messages.parse({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 4000,
    system: SYSTEM,
    output_config: { effort: "low", format: zodOutputFormat(ParsedBetSchema) },
    messages: [{ role: "user", content: `${contextBlock(ctx)}\n\nBet message:\n"""${ctx.text}"""` }],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new ApiError(422, "Couldn't turn that into a bet", "AI_UNPARSEABLE");
  }
  return normalize(response.parsed_output, ctx);
}

// ---------------------------------------------------------------------------------------------
// Offline fallback: a small pattern matcher so the demo never depends on the AI being reachable.

const ASSETS: Record<string, "SOL_USD" | "BTC_USD" | "ETH_USD"> = {
  sol: "SOL_USD",
  solana: "SOL_USD",
  btc: "BTC_USD",
  bitcoin: "BTC_USD",
  eth: "ETH_USD",
  ether: "ETH_USD",
  ethereum: "ETH_USD",
};

export function heuristicParse(ctx: ParseContext): ParsedBet {
  const t = ctx.text.trim();
  const lower = t.toLowerCase();
  const notes = ["Read without AI — double-check every field."];

  const handle = t.match(/@([a-z0-9_]{3,20})/i)?.[1];
  const named = ctx.friends.find(
    (f) => lower.includes(f.username) || (f.displayName && lower.includes(f.displayName.toLowerCase())),
  );
  const opponentUsername = handle ?? named?.username ?? null;

  const dollars = [...t.matchAll(/\$\s?(\d[\d,]*(?:\.\d+)?)/g)].map((m) => Number(m[1].replace(/,/g, "")));
  const odds = t.match(/([+-]\d{3,4})\s*odds|odds\s*(?:of\s*)?([+-]?\d{3,4})/i);
  const oddsAmerican = odds ? Number(odds[1] ?? odds[2]) : null;

  const assetWord = Object.keys(ASSETS).find((a) => new RegExp(`\\b${a}\\b`, "i").test(t));
  const isPrice = !!assetWord && dollars.length >= 2;
  const creatorStakeUsd = dollars[0] ?? 10;
  const threshold = isPrice ? dollars[dollars.length - 1] : null;
  const negated = /\b(doesn'?t|won'?t|can'?t|not|never)\b/i.test(t);

  let kind: "TOUCH_ABOVE" | "TOUCH_BELOW" | "ABOVE_AT" | "BELOW_AT" = "ABOVE_AT";
  if (/\b(drops?|falls?|dips?)\b/i.test(t)) kind = "TOUCH_BELOW";
  else if (/\b(below|under)\b/i.test(t)) kind = "BELOW_AT";
  else if (/\b(hits?|reach(es)?|touch(es)?|breaks?)\b/i.test(t)) kind = "TOUCH_ABOVE";

  // Deadline
  const now = ctx.now;
  let deadline = new Date(now.getTime() + 24 * 3600_000);
  const rel = lower.match(/in\s+(\d+)\s*(min|minute|minutes|hour|hours|hr|hrs|day|days)\b/);
  if (rel) {
    const n = Number(rel[1]);
    const unit = rel[2].startsWith("min") ? 60_000 : rel[2].startsWith("h") ? 3600_000 : 86400_000;
    deadline = new Date(now.getTime() + n * unit);
  } else if (/midnight|tonight/.test(lower)) {
    const off = tzOffset(now, ctx.timezone);
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: ctx.timezone }).format(now); // YYYY-MM-DD
    deadline = new Date(`${day}T23:59:00${off}`);
    if (deadline <= now) deadline = new Date(deadline.getTime() + 86400_000);
  } else if (/tomorrow/.test(lower)) {
    const off = tzOffset(now, ctx.timezone);
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: ctx.timezone }).format(new Date(now.getTime() + 86400_000));
    deadline = new Date(`${day}T20:00:00${off}`);
  } else {
    notes.push("No deadline found — defaulted to 24 hours.");
  }

  const feed = assetWord ? ASSETS[assetWord] : null;
  const asset = feed?.split("_")[0];
  const cmp = kind.includes("ABOVE") ? "at or above" : "at or below";
  const when = deadline.toLocaleString("en-US", { timeZone: ctx.timezone, dateStyle: "medium", timeStyle: "short" });
  const title = isPrice
    ? `${asset} ${kind.startsWith("TOUCH") ? (kind === "TOUCH_ABOVE" ? "hits" : "drops to") : kind === "ABOVE_AT" ? "above" : "below"} $${threshold}`
    : t.replace(/^i\s+bet\s+(@?\w+\s+)?(\$\s?[\d,.]+\s+)?(that\s+)?/i, "").slice(0, 60) || "Friendly bet";
  const conditionText = isPrice
    ? kind.startsWith("TOUCH")
      ? `YES if the ${asset}/USD price reaches ${cmp.replace("at or ", "")} $${threshold} at any point before ${when}.`
      : `YES if the ${asset}/USD price is ${cmp} $${threshold} at ${when}.`
    : `YES if: ${title} (by ${when}).`;

  return normalize(
    {
      opponentUsername,
      title: title.charAt(0).toUpperCase() + title.slice(1),
      conditionText,
      creatorSide: negated && isPrice ? "NO" : "YES",
      creatorStakeUsd,
      opponentStakeUsd: dollars.length >= 2 && !isPrice ? dollars[1] : null,
      oddsAmerican,
      resolution: isPrice ? "ORACLE" : "MUTUAL",
      oracle: isPrice && feed && threshold ? { feed, kind, threshold } : null,
      eventDeadlineISO: deadline.toISOString(),
      confidence: 0.4,
      clarifications: notes,
    },
    ctx,
  );
}
