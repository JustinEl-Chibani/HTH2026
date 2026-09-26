import { z } from "zod";
import { prisma } from "@/lib/db";
import { badRequest, json, notFound, readJson, route } from "@/lib/server/api";
import { requireMember } from "@/lib/server/auth";
import { notify } from "@/lib/server/notify";
import { headToHead } from "@/lib/server/stats";
import { publicUser } from "@/lib/server/users";
import { usernameSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const me = await requireMember();
  const rows = await prisma.friendship.findMany({
    where: { OR: [{ requesterId: me.id }, { addresseeId: me.id }] },
    include: { requester: true, addressee: true },
    orderBy: { createdAt: "desc" },
  });
  const h2h = await headToHead(me.id);
  const friends = rows
    .filter((r) => r.status === "ACCEPTED")
    .map((r) => {
      const other = r.requesterId === me.id ? r.addressee : r.requester;
      const rec = h2h.get(other.id) ?? { wins: 0, losses: 0, net: 0n };
      return { friendshipId: r.id, user: publicUser(other), record: rec };
    })
    .sort((a, b) => (a.user.username ?? "").localeCompare(b.user.username ?? ""));
  const incoming = rows
    .filter((r) => r.status === "PENDING" && r.addresseeId === me.id)
    .map((r) => ({ friendshipId: r.id, user: publicUser(r.requester) }));
  const outgoing = rows
    .filter((r) => r.status === "PENDING" && r.requesterId === me.id)
    .map((r) => ({ friendshipId: r.id, user: publicUser(r.addressee) }));
  return json({ friends, incoming, outgoing });
});

/** Send a friend request by username (auto-accepts if they already asked you). */
export const POST = route(async (req) => {
  const me = await requireMember();
  const { username } = z.object({ username: usernameSchema }).parse(await readJson(req));
  const target = await prisma.user.findUnique({ where: { username } });
  if (!target) throw notFound(`No one called @${username}`);
  if (target.id === me.id) throw badRequest("That's you!");

  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: me.id, addresseeId: target.id },
        { requesterId: target.id, addresseeId: me.id },
      ],
    },
  });
  if (existing?.status === "ACCEPTED") return json({ status: "ACCEPTED" });
  if (existing && existing.requesterId === target.id) {
    await prisma.friendship.update({ where: { id: existing.id }, data: { status: "ACCEPTED" } });
    await notify(target.id, "FRIEND_ACCEPTED", `@${me.username} accepted your friend request`);
    return json({ status: "ACCEPTED" });
  }
  if (existing) return json({ status: "PENDING" });

  await prisma.friendship.create({ data: { requesterId: me.id, addresseeId: target.id } });
  await notify(target.id, "FRIEND_REQUEST", `@${me.username} wants to be friends`);
  return json({ status: "PENDING" });
});
