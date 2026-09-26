import { z } from "zod";
import { json, readJson, route, tooMany } from "@/lib/server/api";
import { getSessionUser } from "@/lib/server/auth";
import { heuristicParse, parseWithClaude, type ParseContext } from "@/lib/server/parse";
import { friendsOf } from "@/lib/server/users";
import { getPrices } from "@/lib/prices";

const body = z.object({
  text: z.string().trim().min(3, "Type a bet first").max(500),
  timezone: z.string().max(64).optional(),
  now: z.iso.datetime({ offset: true }).optional(),
});

function validTimezone(tz: string | undefined): string {
  if (!tz) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

// Guests ("Check it out") can try parsing too, capped per IP so strangers can't run up the AI bill.
const GUEST_LIMIT = 10;
const GUEST_WINDOW_MS = 60 * 60 * 1000;
const guestHits = new Map<string, number[]>();

function checkGuestLimit(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
  const now = Date.now();
  const recent = (guestHits.get(ip) ?? []).filter((t) => now - t < GUEST_WINDOW_MS);
  if (recent.length >= GUEST_LIMIT) throw tooMany("Guest limit reached. Sign in to keep making bets.");
  recent.push(now);
  guestHits.set(ip, recent);
}

/** Natural language → structured bet draft. Falls back to a pattern matcher if the AI is unavailable. */
export const POST = route(async (req) => {
  const me = await getSessionUser();
  if (!me?.username) checkGuestLimit(req);
  const input = body.parse(await readJson(req));
  const friends = me?.username
    ? (await friendsOf(me.id))
        .filter((f) => f.username)
        .map((f) => ({ username: f.username!, displayName: f.displayName }))
    : [];
  const ctx: ParseContext = {
    text: input.text,
    now: new Date(),
    timezone: validTimezone(input.timezone),
    prices: await getPrices(10_000).catch(() => null),
    friends,
  };
  try {
    return json({ parsed: await parseWithClaude(ctx), source: "ai" });
  } catch (e) {
    if (!(e instanceof Error && "code" in e && e.code === "AI_UNAVAILABLE")) {
      console.warn(`[parse-bet] AI parse failed, using heuristic: ${e instanceof Error ? e.message : e}`);
    }
    return json({ parsed: heuristicParse(ctx), source: "heuristic" });
  }
});
