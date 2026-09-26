import { json, route } from "@/lib/server/api";
import { clearSessionCookie } from "@/lib/server/auth";

export const POST = route(async () => {
  await clearSessionCookie();
  return json({ ok: true });
});
