import { z } from "zod";
import { json, readJson, route } from "@/lib/server/api";
import { requireMember } from "@/lib/server/auth";
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

/** Natural language → structured bet draft. Falls back to a pattern matcher if the AI is unavailable. */
export const POST = route(async (req) => {
  const me = await requireMember();
  const input = body.parse(await readJson(req));
  const friends = (await friendsOf(me.id))
    .filter((f) => f.username)
    .map((f) => ({ username: f.username!, displayName: f.displayName }));
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
