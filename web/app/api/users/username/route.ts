import { z } from "zod";
import { prisma } from "@/lib/db";
import { badRequest, json, readJson, route } from "@/lib/server/api";
import { requireUser } from "@/lib/server/auth";
import { publicUser } from "@/lib/server/users";
import { displayNameSchema, usernameSchema } from "@/lib/validation";

const body = z.object({ username: usernameSchema, displayName: displayNameSchema.optional() });

export const POST = route(async (req) => {
  const user = await requireUser();
  const { username, displayName } = body.parse(await readJson(req));
  const taken = await prisma.user.findUnique({ where: { username } });
  if (taken && taken.id !== user.id) throw badRequest("That username is taken", "USERNAME_TAKEN");
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { username, displayName: displayName ?? user.displayName ?? username },
  });
  return json({ user: publicUser(updated) });
});
