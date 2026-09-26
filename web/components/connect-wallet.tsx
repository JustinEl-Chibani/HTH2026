"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState, type WalletName } from "@solana/wallet-adapter-base";
import { Loader2, Wallet as WalletIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BURNER_ENABLED } from "@/components/providers";
import { useSession } from "@/components/session-provider";
import { BurnerWalletName } from "@/lib/burner";

export function ConnectWallet() {
  const { wallets, select, connect, wallet, connecting, connected } = useWallet();
  const { signingIn, needsSignIn, signIn } = useSession();

  const choose = (name: WalletName) => {
    // Already connected with this wallet but not signed in (e.g. the signature was declined): retry sign-in.
    if (connected && needsSignIn && wallet?.adapter.name === name) void signIn();
    else if (wallet?.adapter.name === name) void connect().catch(() => {});
    else select(name);
  };

  const real = wallets.filter(
    (w) => w.adapter.name !== BurnerWalletName && w.readyState === WalletReadyState.Installed,
  );
  const busy = connecting || signingIn;

  return (
    <div className="flex w-full flex-col gap-3">
      {real.map((w) => (
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
      {real.length === 0 && (
        <Button asChild size="lg" variant="outline" className="h-14 w-full text-base font-bold">
          <a href="https://phantom.com/download" target="_blank" rel="noreferrer">
            <WalletIcon /> Link Phantom
          </a>
        </Button>
      )}
      {BURNER_ENABLED && (
        <Button
          size="lg"
          variant={real.length ? "secondary" : "default"}
          className="h-14 w-full text-base font-bold"
          onClick={() => choose(BurnerWalletName)}
          disabled={busy}
        >
          {busy && wallet?.adapter.name === BurnerWalletName ? <Loader2 className="animate-spin" /> : <span aria-hidden>🔥</span>}
          Try with a burner wallet
        </Button>
      )}
    </div>
  );
}
