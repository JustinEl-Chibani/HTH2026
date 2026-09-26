"use client";
// "Check it out" guest mode: browse without a wallet. Anything that moves money is greyed out.
// Purely a client-side view mode; guests have no session, and every write API still requires sign-in.
import { useSyncExternalStore } from "react";

const KEY = "pym:guest";
const EVENT = "pym:guest-change";

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function write(on: boolean) {
  try {
    if (on) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    /* storage blocked: guest mode just won't persist */
  }
  window.dispatchEvent(new Event(EVENT));
}

export const enterGuest = () => write(true);
export const exitGuest = () => write(false);

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Whether guest mode is on in this browser (false during SSR). */
export function useGuestFlag(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}
