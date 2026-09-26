"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import bs58 from "bs58";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { friendlyError } from "@/lib/errors";
import { exitGuest, useGuestFlag } from "@/lib/guest";

export interface Me {
  id: string;
  wallet: string;
  username: string | null;
  displayName: string | null;
  avatarSeed: string;
}

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api<{ user: Me | null }>("/api/me").then((r) => r.user),
    staleTime: 30_000,
  });
}

/**
 * Sign-In With Solana. Signs a nonce message with the connected wallet; the server sets an
 * httpOnly session cookie. Auto-runs once per wallet connection when the session doesn't match.
 */
export function useSignIn() {
  const { publicKey, signMessage, connected } = useWallet();
  const qc = useQueryClient();
  const { data: me, isFetched } = useMe();
  const [signingIn, setSigningIn] = useState(false);
  const attempted = useRef<string | null>(null);

  const signIn = useCallback(async () => {
    if (!publicKey || !signMessage) return;
    setSigningIn(true);
    try {
      const wallet58 = publicKey.toBase58();
      const { nonce, message } = await api<{ nonce: string; message: string }>("/api/auth/nonce", {
        body: { wallet: wallet58 },
      });
      const sig = await signMessage(new TextEncoder().encode(message));
      const { user } = await api<{ user: Me }>("/api/auth/verify", {
        body: { wallet: wallet58, nonce, signature: bs58.encode(sig) },
      });
      exitGuest(); // a real session replaces guest mode
      qc.setQueryData(["me"], user);
      await qc.invalidateQueries();
    } catch (e) {
      console.error("[sign-in] failed:", e); // raw wallet/API error for debugging in DevTools
      toast.error(friendlyError(e));
    } finally {
      setSigningIn(false);
    }
  }, [publicKey, signMessage, qc]);

  const walletAddr = publicKey?.toBase58() ?? null;
  const needsSignIn = connected && !!walletAddr && isFetched && me?.wallet !== walletAddr;

  useEffect(() => {
    if (needsSignIn && attempted.current !== walletAddr) {
      attempted.current = walletAddr;
      void signIn();
    }
  }, [needsSignIn, walletAddr, signIn]);

  return { signIn, signingIn, needsSignIn };
}

export async function logout(qcClear: () => void, disconnect: () => Promise<void>) {
  await api("/api/auth/logout", { body: {} });
  await disconnect().catch(() => {});
  qcClear();
}

/**
 * Who is looking at the page: a signed-in member, or a guest ("Check it out"). A real session always
 * wins over the guest flag.
 */
export function useViewer() {
  const { data: me, isFetched } = useMe();
  const guestFlag = useGuestFlag();
  const member = me?.username ? (me as Me & { username: string }) : null;
  return { me: member, isGuest: !member && guestFlag, ready: isFetched };
}
