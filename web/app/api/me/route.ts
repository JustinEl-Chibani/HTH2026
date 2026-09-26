import { json, route } from "@/lib/server/api";
import { getSessionUser } from "@/lib/server/auth";
import { publicUser } from "@/lib/server/users";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const user = await getSessionUser();
  return json({ user: user ? publicUser(user) : null });
});
