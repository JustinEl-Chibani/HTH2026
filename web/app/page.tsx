"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { ConnectWallet } from "@/components/connect-wallet";
import { BURNER_ENABLED } from "@/components/providers";
import { useMe } from "@/hooks/use-session";
import { api } from "@/lib/api-client";
import { BurnerWalletName, importBurnerSecret } from "@/lib/burner";

function Landing() {
  const { data: me } = useMe();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const demoKey = params.get("demoKey");
  const [importing, setImporting] = useState(!!demoKey && BURNER_ENABLED);

  // Demo links (printed by scripts/seed-demo.ts): load a known burner key, then reload signed out
  // so the burner auto-connects and signs in as that user.
  useEffect(() => {
    if (!demoKey || !BURNER_ENABLED) return;
    const addr = importBurnerSecret(demoKey);
    if (!addr) {
      setImporting(false);
      return;
    }
    localStorage.setItem("walletName", JSON.stringify(BurnerWalletName));
    void api("/api/auth/logout", { body: {} })
      .catch(() => {})
      .then(() => window.location.replace(next && next.startsWith("/") ? `/?next=${encodeURIComponent(next)}` : "/"));
  }, [demoKey, next]);

  useEffect(() => {
    if (!me || importing) return;
    if (!me.username) router.replace(`/onboarding${next ? `?next=${encodeURIComponent(next)}` : ""}`);
    else router.replace(next && next.startsWith("/") ? next : "/home");
  }, [me, next, router, importing]);

  if (importing) {
    return (
      <main className="grid min-h-dvh place-items-center">
        <p className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="animate-spin" /> Loading demo wallet…
        </p>
      </main>
    );
  }

  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-80 w-[36rem] -translate-x-1/2 rounded-full bg-primary/25 blur-3xl md:left-[35%] md:h-[30rem] md:w-[56rem]"
      />
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-16 pb-10 md:grid md:max-w-6xl md:grid-cols-[1.2fr_1fr] md:items-center md:gap-16 md:py-16">
      <div className="relative flex flex-1 flex-col md:contents">
        <div className="md:self-center">
        <div className="text-7xl drop-shadow-[0_8px_24px_rgba(182,240,60,.35)]">💸</div>
        <h1 className="mt-6 text-5xl leading-[0.95] font-black tracking-tight md:text-7xl">
          Put your money
          <br />
          <span className="text-brand-ink">where your mouth is.</span>
        </h1>
        <p className="mt-5 text-lg text-muted-foreground md:max-w-xl md:text-xl">
          Turn &ldquo;bet you $10&rdquo; into a real bet with your friends. Haggle the odds, lock the cash,
          and let the winner get paid automatically.
        </p>

        <ul className="mt-8 space-y-3 text-sm md:grid md:grid-cols-2 md:gap-3 md:space-y-0 md:text-base">
          {[
            ["✍️", "Type the bet in plain English"],
            ["🤝", "Counteroffer until it's fair"],
            ["🔒", "Both sides lock money in escrow"],
            ["🏆", "Winner gets the whole pot"],
          ].map(([icon, text]) => (
            <li key={text} className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-xl bg-card text-lg">{icon}</span>
              <span className="font-medium">{text}</span>
            </li>
          ))}
        </ul>
        </div>

        <div className="relative mt-auto pt-10 md:mt-0 md:rounded-3xl md:border md:border-border/60 md:bg-card/80 md:p-8 md:pt-8 md:shadow-2xl md:backdrop-blur">
          <p className="mb-5 hidden text-2xl font-black md:block">Get in on it</p>
          <ConnectWallet />
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Runs on Solana devnet with test money. No real funds, ever.
          </p>
        </div>
      </div>
    </main>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Landing />
    </Suspense>
  );
}
