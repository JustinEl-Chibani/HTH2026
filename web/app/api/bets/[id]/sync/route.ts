import { z } from "zod";
import { prisma } from "@/lib/db";
import { forbidden, json, notFound, readJson, route } from "@/lib/server/api";
import { requireMember } from "@/lib/server/auth";
import { getBetDetail } from "@/lib/server/bets";
import { syncBet } from "@/lib/server/sync";

const body = z.object({
  txSig: z.string().min(60).max(100).optional(),
  termsJson: z.string().max(4000).optional(),
});

/**
 * Called by a participant right after their transaction confirms. We never trust client-provided
 * state: the server re-reads the Bet account from chain and updates the DB from that.
 */
export const POST = route(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const me = await requireMember();
  const { id } = await params;
  const opts = body.parse(await readJson(req));
  const bet = await prisma.bet.findUnique({ where: { id } });
  if (!bet) throw notFound("Bet not found");
  // Anyone may sync an open bet: the taker isn't a participant in the DB until this sync attaches them.
  const openBet = bet.isPublic && !bet.opponentId;
  if (!openBet && bet.creatorId !== me.id && bet.opponentId !== me.id) throw forbidden("You're not in this bet");
  await syncBet(id, opts);
  return json({ bet: await getBetDetail(id) });
});
