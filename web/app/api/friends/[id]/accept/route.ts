import { prisma } from "@/lib/db";
import { json, notFound, route } from "@/lib/server/api";
import { requireMember } from "@/lib/server/auth";
import { notify } from "@/lib/server/notify";

export const POST = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const me = await requireMember();
  const { id } = await params;
  const row = await prisma.friendship.findUnique({ where: { id } });
  if (!row || row.addresseeId !== me.id) throw notFound("Friend request not found");
  if (row.status !== "ACCEPTED") {
    await prisma.friendship.update({ where: { id }, data: { status: "ACCEPTED" } });
    await notify(row.requesterId, "FRIEND_ACCEPTED", `@${me.username} accepted your friend request`);
  }
  return json({ status: "ACCEPTED" });
});
