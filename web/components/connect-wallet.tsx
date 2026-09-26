"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState, type WalletName } from "@solana/wallet-adapter-base";
import { Eye, Loader2, Wallet as WalletIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useSession } from "@/components/session-provider";
import { enterGuest } from "@/lib/guest";

/** Wallet sign-in buttons. `showGuest` adds "Check it out" (browse without a wallet). */
export function ConnectWallet({ showGuest = false }: { showGuest?: boolean }) {
  const { wallets, select, connect, wallet, connecting, connected } = useWallet();
  const { signingIn, needsSignIn, signIn } = useSession();
  const router = useRouter();

  const choose = (name: WalletName) => {
    // Already connected with this wallet but not signed in (e.g. the signature was declined): retry sign-in.
    if (connected && needsSignIn && wallet?.adapter.name === name) void signIn();
    else if (wallet?.adapter.name === name) void connect().catch(() => {});
    else select(name);
  };

  const installed = wallets.filter((w) => w.readyState === WalletReadyState.Installed);
  const busy = connecting || signingIn;

  return (
    <div className="flex w-full flex-col gap-3">
      {installed.map((w) => (
        <Button
          key={w.adapter.name}
          size="lg"
          className="h-14 w-full justify-start gap-3 text-base font-bold"
          onClick={() => choose(w.adapter.name)}
          disabled={busy}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={w.adapter.icon} alt="" className="size-7 rounded-md" />
          Link {w.adapter.name}
          {busy && wallet?.adapter.name === w.adapter.name && <Loader2 className="ml-auto animate-spin" />}
        </Button>
      ))}
      {installed.length === 0 && (
        <Button asChild size="lg" className="h-14 w-full text-base font-bold">
          <a href="https://phantom.com/download" target="_blank" rel="noreferrer">
            <WalletIcon /> Get Phantom to sign in
          </a>
        </Button>
      )}
      {showGuest && (
        <Button
          size="lg"
          variant="secondary"
          className="h-14 w-full text-base font-bold"
          onClick={() => {
            enterGuest();
            router.push("/home");
          }}
          disabled={busy}
        >
          <Eye /> Check it out
        </Button>
      )}
    </div>
  );
}
