import { z } from "zod";
import { prisma } from "@/lib/db";
import { json, readJson, route } from "@/lib/server/api";
import { requireUser } from "@/lib/server/auth";
import { publicUser } from "@/lib/server/users";
import { walletKindSchema } from "@/lib/validation";

/**
 * Classify an account that signed in before wallet kinds existed. One-time: once set, the kind
 * never changes (so an account can't hop between the burner sandbox and real wallets).
 */
export const POST = route(async (req) => {
  const me = await requireUser();
  const { walletKind } = z.object({ walletKind: walletKindSchema }).parse(await readJson(req));
  if (me.walletKind) return json({ user: publicUser(me) });
  const user = await prisma.user.update({ where: { id: me.id }, data: { walletKind } });
  return json({ user: publicUser(user) });
});
