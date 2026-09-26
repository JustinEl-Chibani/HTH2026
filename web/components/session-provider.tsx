"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useSignIn } from "@/hooks/use-session";

type SessionCtx = ReturnType<typeof useSignIn>;

const Ctx = createContext<SessionCtx | null>(null);

/** Mount once: owns the auto sign-in side effect. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const value = useSignIn();
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession must be used inside <SessionProvider>");
  return v;
}
