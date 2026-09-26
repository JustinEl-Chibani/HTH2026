"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { ConnectWallet } from "@/components/connect-wallet";
import { useMe } from "@/hooks/use-session";

function Landing() {
  const { data: me } = useMe();
  const router = useRouter();
  const next = useSearchParams().get("next");

  useEffect(() => {
    if (!me) return;
    if (!me.username) router.replace(`/onboarding${next ? `?next=${encodeURIComponent(next)}` : ""}`);
    else router.replace(next && next.startsWith("/") ? next : "/home");
  }, [me, next, router]);

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col overflow-hidden px-6 pt-16 pb-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-80 w-[36rem] -translate-x-1/2 rounded-full bg-primary/25 blur-3xl"
      />
      <div className="relative flex flex-1 flex-col">
        <div className="text-7xl drop-shadow-[0_8px_24px_rgba(182,240,60,.35)]">💸</div>
        <h1 className="mt-6 text-5xl leading-[0.95] font-black tracking-tight">
          Put your money
          <br />
          <span className="text-brand-ink">where your mouth is.</span>
        </h1>
        <p className="mt-5 text-lg text-muted-foreground">
          Turn &ldquo;bet you $10&rdquo; into a real bet with your friends. Haggle the odds, lock the cash,
          and let the winner get paid automatically.
        </p>

        <ul className="mt-8 space-y-3 text-sm">
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

        <div className="mt-auto pt-10">
          <ConnectWallet />
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Runs on Solana devnet with test money. No real funds, ever.
          </p>
        </div>
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Landing />
    </Suspense>
  );
}
