"use client";

import { api } from "./api-client";
import { selectBurnerForNextLoad } from "./burner";

/**
 * After the active burner key has been set (saved account, login link, demo link): end the current
 * session and reload, so the burner auto-connects and signs in as that account.
 */
export async function reloginAsActiveBurner(next?: string | null) {
  selectBurnerForNextLoad();
  await api("/api/auth/logout", { body: {} }).catch(() => {});
  window.location.replace(next && next.startsWith("/") ? `/?next=${encodeURIComponent(next)}` : "/");
}
