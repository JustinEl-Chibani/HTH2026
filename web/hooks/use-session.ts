"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import bs58 from "bs58";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { BurnerWalletName } from "@/lib/burner";
import { friendlyError } from "@/lib/errors";

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
  const { publicKey, signMessage, wallet, connected } = useWallet();
  const { connection } = useConnection();
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
      qc.setQueryData(["me"], user);
      await qc.invalidateQueries();
    } catch (e) {
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

  // Burner wallets start empty: top them up with a little SOL for fees once signed in.
  const isBurner = wallet?.adapter.name === BurnerWalletName;
  const toppedUp = useRef<string | null>(null);
  useEffect(() => {
    if (!isBurner || !me || me.wallet !== walletAddr || toppedUp.current === walletAddr) return;
    toppedUp.current = walletAddr;
    void (async () => {
      try {
        const bal = await connection.getBalance(publicKey!);
        if (bal < 0.02 * LAMPORTS_PER_SOL) {
          await api("/api/faucet", { body: { kind: "SOL" } });
          qc.invalidateQueries({ queryKey: ["balances"] });
        }
      } catch {
        /* non-fatal: profile page has a manual button */
      }
    })();
  }, [isBurner, me, walletAddr, publicKey, connection, qc]);

  return { signIn, signingIn, needsSignIn };
}

export async function logout(qcClear: () => void, disconnect: () => Promise<void>) {
  await api("/api/auth/logout", { body: {} });
  await disconnect().catch(() => {});
  qcClear();
}
