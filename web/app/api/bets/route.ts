import { z } from "zod";
import { draftSchema } from "@/lib/bet-schema";
import { prisma } from "@/lib/db";
import { json, readJson, route } from "@/lib/server/api";
import { requireMember } from "@/lib/server/auth";
import { createDraft, toDto } from "@/lib/server/bets";

export const dynamic = "force-dynamic";

const FILTERS = {
  active: ["PROPOSED", "ACCEPTED", "ACTIVE", "AWAITING_CONFIRMATION"],
  pending: ["PROPOSED", "ACCEPTED"],
  settled: ["SETTLED", "CANCELLED", "EXPIRED", "VOID"],
  all: ["PROPOSED", "ACCEPTED", "ACTIVE", "AWAITING_CONFIRMATION", "SETTLED", "CANCELLED", "EXPIRED", "VOID"],
} as const;

export const GET = route(async (req) => {
  const me = await requireMember();
  const filter = z
    .enum(["active", "pending", "settled", "all"])
    .catch("all")
    .parse(new URL(req.url).searchParams.get("filter") ?? "all");
  const bets = await prisma.bet.findMany({
    where: {
      state: { in: [...FILTERS[filter]] },
      OR: [{ creatorId: me.id }, { opponentId: me.id }],
    },
    include: { creator: true, opponent: true },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return json({ bets: bets.map(toDto) });
});

/** Create a draft: validates terms, assigns the on-chain bet id and returns the canonical terms hash. */
export const POST = route(async (req) => {
  const me = await requireMember();
  const draft = draftSchema.parse(await readJson(req));
  return json(await createDraft(me, draft));
});
