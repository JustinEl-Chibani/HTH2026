import { prisma } from "@/lib/db";
import { json, route } from "@/lib/server/api";
import { requireMember } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const me = await requireMember();
  const unread = await prisma.notification.count({ where: { userId: me.id, read: false } });
  if (new URL(req.url).searchParams.get("countOnly")) return json({ unread });
  const notifications = await prisma.notification.findMany({
    where: { userId: me.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { bet: { select: { id: true, title: true, state: true } } },
  });
  return json({ unread, notifications });
});
