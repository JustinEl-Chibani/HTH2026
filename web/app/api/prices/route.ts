import { json, route } from "@/lib/server/api";
import { getPrices } from "@/lib/prices";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  try {
    return json({ prices: await getPrices() });
  } catch {
    return json({ error: "Price feeds are unavailable right now", prices: null }, { status: 503 });
  }
});
