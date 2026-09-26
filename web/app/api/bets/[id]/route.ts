import { json, route } from "@/lib/server/api";
import { requireMember } from "@/lib/server/auth";
import { getBetDetail } from "@/lib/server/bets";

export const dynamic = "force-dynamic";

// Any signed-in member can open a bet link (they're shared between friends); only the two
// participants can act on it, which the program enforces.
export const GET = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  await requireMember();
  const { id } = await params;
  return json({ bet: await getBetDetail(id) });
});
