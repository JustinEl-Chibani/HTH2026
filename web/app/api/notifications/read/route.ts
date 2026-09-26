import { z } from "zod";
import { prisma } from "@/lib/db";
import { json, readJson, route } from "@/lib/server/api";
import { requireMember } from "@/lib/server/auth";

/** Mark specific notifications (or all, when `ids` is omitted) as read. */
export const POST = route(async (req) => {
  const me = await requireMember();
  const { ids } = z.object({ ids: z.array(z.string()).max(200).optional() }).parse(await readJson(req));
  await prisma.notification.updateMany({
    where: { userId: me.id, read: false, ...(ids ? { id: { in: ids } } : {}) },
    data: { read: true },
  });
  return json({ ok: true });
});
