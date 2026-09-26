import { json, route, unauthorized } from "@/lib/server/api";
import { serverEnv } from "@/lib/server/env";
import { runResolverTick } from "@/lib/server/resolver";

export const dynamic = "force-dynamic";

/** One resolver pass, for hosted cron (Vercel cron etc.). Requires the CRON_SECRET. */
export const POST = route(async (req) => {
  const secret = serverEnv().CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? req.headers.get("x-cron-secret");
  if (!secret || given !== secret) throw unauthorized("Bad cron secret");
  const logs: string[] = [];
  const summary = await runResolverTick((m) => logs.push(m));
  return json({ ...summary, logs });
});

export const GET = POST;
