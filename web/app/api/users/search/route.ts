import { z } from "zod";
import { prisma } from "@/lib/db";
import { json, route } from "@/lib/server/api";
import { requireMember } from "@/lib/server/auth";
import { publicUser } from "@/lib/server/users";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const me = await requireMember();
  const q = z
    .string()
    .trim()
    .toLowerCase()
    .max(40)
    .parse(new URL(req.url).searchParams.get("q") ?? "");
  if (q.length < 1) return json({ users: [] });
  const users = await prisma.user.findMany({
    where: {
      id: { not: me.id },
      username: { not: null },
      OR: [{ username: { contains: q } }, { displayName: { contains: q } }],
    },
    take: 10,
    orderBy: { username: "asc" },
  });
  return json({ users: users.map(publicUser) });
});
