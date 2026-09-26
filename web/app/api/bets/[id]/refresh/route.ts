import { prisma } from "@/lib/db";
import { json, notFound, route } from "@/lib/server/api";
import { requireMember } from "@/lib/server/auth";
import { getBetDetail } from "@/lib/server/bets";
import { syncBet } from "@/lib/server/sync";
import { TERMINAL_STATES, type BetStateStr } from "@/lib/solana/codec";

export const dynamic = "force-dynamic";

// Polling endpoint: re-reads the chain at most every few seconds per bet, then returns the detail.
const lastRead = new Map<string, number>();
const MIN_INTERVAL_MS = 2_500;

export const POST = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  await requireMember();
  const { id } = await params;
  const bet = await prisma.bet.findUnique({ where: { id }, select: { state: true } });
  if (!bet) throw notFound("Bet not found");
  const now = Date.now();
  const isFinal = TERMINAL_STATES.includes(bet.state as BetStateStr);
  if (!isFinal && now - (lastRead.get(id) ?? 0) > MIN_INTERVAL_MS) {
    lastRead.set(id, now);
    try {
      await syncBet(id);
    } catch (e) {
      console.warn(`[refresh] ${id}: ${e instanceof Error ? e.message : e}`);
    }
  }
  return json({ bet: await getBetDetail(id) });
});
