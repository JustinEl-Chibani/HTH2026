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
    if (wallet?.adapter.name === name) void connect().catch(() => {});
    else select(name);
  };

  const real = wallets.filter(
    (w) => w.adapter.name !== BurnerWalletName && w.readyState === WalletReadyState.Installed,
  );
  const busy = connecting || signingIn;

  if (connected && needsSignIn) {
    return (
      <Button size="lg" className="h-14 w-full text-base font-bold" onClick={signIn} disabled={signingIn}>
        {signingIn ? <Loader2 className="animate-spin" /> : null}
        {signingIn ? "Check your wallet…" : "Sign in to continue"}
      </Button>
    );
  }

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
          Connect {w.adapter.name}
          {busy && wallet?.adapter.name === w.adapter.name && <Loader2 className="ml-auto animate-spin" />}
        </Button>
      ))}
      {real.length === 0 && (
        <Button asChild size="lg" variant="outline" className="h-14 w-full text-base font-bold">
          <a href="https://phantom.com/download" target="_blank" rel="noreferrer">
            <WalletIcon /> Get Phantom
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
          {busy && wallet?.adapter.name === BurnerWalletName ? <Loader2 className="animate-spin" /> : "🔥"}
          Try with a burner wallet
        </Button>
      )}
    </div>
  );
}
