import { prisma } from "@/lib/db";
import { json, route } from "@/lib/server/api";
import { requireMember } from "@/lib/server/auth";
import { headToHead, recordOf } from "@/lib/server/stats";
import { publicUser } from "@/lib/server/users";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const me = await requireMember();
  const [record, h2h, activeCount] = await Promise.all([
    recordOf(me.id),
    headToHead(me.id),
    prisma.bet.count({
      where: {
        state: { in: ["PROPOSED", "ACCEPTED", "ACTIVE", "AWAITING_CONFIRMATION"] },
        OR: [{ creatorId: me.id }, { opponentId: me.id }],
      },
    }),
  ]);
  const opponents = await prisma.user.findMany({ where: { id: { in: [...h2h.keys()] } } });
  const vsFriends = opponents
    .map((u) => ({ user: publicUser(u), record: h2h.get(u.id)! }))
    .sort((a, b) => b.record.wins + b.record.losses - (a.record.wins + a.record.losses));
  return json({ record, activeCount, vsFriends });
});
