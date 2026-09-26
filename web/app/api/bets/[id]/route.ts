import { json, route } from "@/lib/server/api";
import { getBetDetail } from "@/lib/server/bets";

export const dynamic = "force-dynamic";

// Anyone with the link can view a bet (including guests browsing via "Check it out"); only the
// participants can act on it, which the program enforces.
export const GET = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return json({ bet: await getBetDetail(id) });
});
