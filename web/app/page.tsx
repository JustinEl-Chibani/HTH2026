"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Handshake, Loader2, Lock, PenLine, Trophy, type LucideIcon } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { ConnectWallet } from "@/components/connect-wallet";
import { useMe } from "@/hooks/use-session";
import { api } from "@/lib/api-client";
import { BurnerWalletName, importBurnerSecret } from "@/lib/burner";
import { Logo, Wordmark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

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
    <div className="relative isolate min-h-dvh overflow-hidden">
      <Backdrop />

      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 pt-6">
        <div className="flex items-center gap-2.5">
          <Logo size={38} priority />
          <Wordmark className="text-2xl" />
        </div>
        <ThemeToggle />
      </header>

      <main className="mx-auto max-w-6xl px-6">
        <Hero />
        <HowItWorks />
      </main>

      <Footer />
    </div>
  );
}

/* ——— Layout pieces ——— */

function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute inset-x-0 top-0 h-[64rem]">
        <div className="absolute -top-40 -left-24 h-96 w-96 rounded-full bg-primary/25 blur-[120px] md:h-[34rem] md:w-[34rem]" />
        <div className="absolute top-1/3 -right-32 h-80 w-80 rounded-full bg-yes/15 blur-[120px] md:h-[30rem] md:w-[30rem]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle,var(--foreground)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)] bg-[size:22px_22px] opacity-[0.06]" />
      </div>
      <div className="absolute top-[110rem] -left-40 h-96 w-96 rounded-full bg-primary/10 blur-[140px] md:top-[80rem]" />
    </div>
  );
}

function Hero() {
  return (
    <section className="grid gap-12 pt-14 pb-24 md:min-h-[calc(100dvh-5.5rem)] md:grid-cols-[1.35fr_1fr] md:items-center md:gap-16 md:py-16">
      <div>
        <h1 className="text-[2.8rem] leading-[0.95] font-black tracking-tight text-balance md:text-[4.15rem]">
          Put your money <span className="text-brand-ink">where your mouth is.</span>
        </h1>
        <p className="mt-6 max-w-xl text-[15px] text-muted-foreground md:text-xl">
          Set the odds against your friends. Lock your cash in a pot, winner gets paid automatically.
        </p>

        <dl className="mt-12 grid max-w-lg grid-cols-3 divide-x divide-border/60 border-y border-border/60">
          {[
            ["0%", "House cut"],
            ["100%", "Pot to the winner"],
            ["On-chain", "Escrow & payout"],
          ].map(([value, label]) => (
            <div key={label} className="px-3 py-4 first:pl-0 sm:px-4">
              <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">{label}</dt>
              <dd className="mt-1 text-xl font-black tracking-tight whitespace-nowrap sm:text-2xl md:text-3xl">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="rounded-3xl border border-border/60 bg-card/80 p-6 shadow-2xl backdrop-blur md:p-8 dark:bg-black/45">
        <h2 className="mb-6 text-2xl font-black md:text-3xl">Get in on it</h2>
        <ConnectWallet />
      </div>
    </section>
  );
}

/* ——— How it works ——— */

const STEPS: [LucideIcon, string, string][] = [
  [PenLine, "Say it in plain English", "Type it like a text. AI writes the terms."],
  [Handshake, "Agree on the odds", "Accept, decline, or send a counteroffer."],
  [Lock, "Lock it in escrow", "Both stakes lock in a Solana program."],
  [Trophy, "Winner takes the pot", "Oracle or mutual call. Winner gets paid."],
];

function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-28 pb-28 md:pb-36">
      <div aria-hidden className="mb-20 h-px bg-gradient-to-r from-transparent via-border to-transparent md:mb-28" />
      <SectionHeading eyebrow="How it works" title="Four steps. Zero trust required." />
      <ol className="mt-12 grid border-t border-border/60 md:grid-cols-4">
        {STEPS.map(([Icon, title, body], i) => (
          <li
            key={title}
            className="border-b border-border/60 py-8 md:border-b-0 md:border-l md:px-6 md:first:border-l-0 md:first:pl-0"
          >
            <div className="flex items-center justify-between">
              <span className="grid size-10 place-items-center rounded-xl border border-border/70 bg-card/70">
                <Icon className="size-5 text-brand-ink" strokeWidth={2.25} />
              </span>
              <span className="font-mono text-xs tracking-widest text-muted-foreground">0{i + 1}</span>
            </div>
            <h3 className="mt-6 text-lg font-medium tracking-tight">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/50">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Logo size={28} />
          <Wordmark className="text-lg" />
        </div>
        <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">Built on Solana</p>
      </div>
    </footer>
  );
}

/* ——— Small bits ——— */

function SectionHeading({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return (
    <div className="max-w-3xl">
      <p className="font-mono text-[11px] tracking-[0.2em] text-brand-ink uppercase">{eyebrow}</p>
      <h2 className="mt-3 text-4xl leading-[0.95] font-black tracking-tight text-balance md:text-6xl">{title}</h2>
      {body && <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">{body}</p>}
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
