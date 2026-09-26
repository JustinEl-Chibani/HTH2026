"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ArrowUpRight, Handshake, Loader2, Lock, PenLine, Trophy, type LucideIcon } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { ConnectWallet } from "@/components/connect-wallet";
import { BURNER_ENABLED } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { usePrices, type ClientPrices } from "@/hooks/use-prices";
import { useMe } from "@/hooks/use-session";
import { api } from "@/lib/api-client";
import { BurnerWalletName, importBurnerSecret } from "@/lib/burner";
import { formatPrice } from "@/lib/money";
import type { FeedStr } from "@/lib/solana/codec";
import { cn } from "@/lib/utils";
import { Logo, Wordmark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

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
    <div className="relative isolate min-h-dvh overflow-hidden">
      <Backdrop />
      <Nav />
      <Ticker />

      <main className="mx-auto max-w-6xl px-6">
        <Hero />
        <Markets />
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

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/50 bg-background/60 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-6">
        <a href="#" className="flex items-center gap-2.5">
          <Logo size={30} priority />
          <Wordmark className="text-xl" />
        </a>
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <a href="#markets" className="transition-colors hover:text-foreground">
            Markets
          </a>
          <a href="#how" className="transition-colors hover:text-foreground">
            How it works
          </a>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Button asChild className="h-9 rounded-full px-4 font-bold">
            <a href="#connect">
              Launch app <ArrowRight />
            </a>
          </Button>
        </div>
      </div>
    </header>
  );
}

const FEEDS: { feed: FeedStr; label: string }[] = [
  { feed: "SOL_USD", label: "SOL" },
  { feed: "BTC_USD", label: "BTC" },
  { feed: "ETH_USD", label: "ETH" },
];

function Ticker() {
  const { data: prices } = usePrices();
  return (
    <div className="border-b border-border/50 bg-background/40 backdrop-blur">
      <div className="no-scrollbar mx-auto flex h-10 max-w-6xl items-center gap-6 overflow-x-auto px-6 font-mono text-[11px] tracking-wider whitespace-nowrap text-muted-foreground uppercase">
        <span className="flex items-center gap-2 text-foreground">
          <LiveDot /> Live oracle
        </span>
        {FEEDS.map(({ feed, label }) => (
          <span key={feed} className="flex items-center gap-2">
            {label}
            <span className="tabular text-foreground">{prices?.[feed] ? formatPrice(prices[feed].price) : "—"}</span>
          </span>
        ))}
        <span className="ml-auto hidden md:inline">Solana devnet</span>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="grid gap-12 pt-16 pb-24 md:grid-cols-[1.35fr_1fr] md:items-center md:gap-16 md:pt-24 md:pb-32">
      <div>
        <Logo size={112} priority className="-ml-2 drop-shadow-[0_12px_32px_rgba(182,240,60,.25)] md:size-[140px]" />
        <Eyebrow className="mt-6">Peer-to-peer bets · Settled on Solana</Eyebrow>
        <h1 className="mt-4 text-6xl md:text-8xl">
          <Wordmark />
        </h1>
        <p className="mt-4 flex items-center gap-3 text-xl leading-tight font-medium tracking-tight md:text-3xl">
          <span aria-hidden className="h-7 w-1 shrink-0 rounded-full bg-primary md:h-9" />
          <span className="text-balance">
            Put your money <span className="text-brand-ink">where your mouth is.</span>
          </span>
        </p>
        <p className="mt-5 max-w-xl text-lg text-muted-foreground md:text-xl">
          Turn any &ldquo;bet you $10&rdquo; into a binding bet with a friend. Haggle the odds, lock both stakes in
          escrow, and the winner is paid automatically. No bookie, no house, no chasing anyone for money.
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Button asChild className="glow-primary h-12 rounded-full px-6 text-base font-bold">
            <a href="#connect">
              Start a bet <ArrowRight />
            </a>
          </Button>
          <Button asChild variant="ghost" className="h-12 rounded-full px-5 text-base text-muted-foreground">
            <a href="#how">How it works</a>
          </Button>
        </div>

        <dl className="mt-14 grid max-w-lg grid-cols-3 divide-x divide-border/60 border-y border-border/60">
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

      <div id="connect" className="scroll-mt-32">
        <div className="rounded-3xl border border-border/60 bg-card/80 shadow-2xl backdrop-blur">
          <div className="p-6 md:p-8">
            <Eyebrow>Get started</Eyebrow>
            <h2 className="mt-3 text-2xl font-black md:text-3xl">Get in on it</h2>
            <p className="mt-1.5 mb-6 text-sm text-muted-foreground">
              Connect a wallet to challenge friends. Free, and it takes seconds.
            </p>
            <ConnectWallet />
            <p className="mt-5 text-center font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              Devnet · Test money only · No real funds
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ——— Example markets (built on the live oracle price) ——— */

type Example = {
  feed?: FeedStr;
  step?: number;
  question: (threshold: string) => string;
  yes: [string, number];
  no: [string, number];
  ends: string;
  settle: string;
};

const EXAMPLES: Example[] = [
  {
    feed: "SOL_USD",
    step: 5,
    question: (t) => `SOL above ${t} by Friday?`,
    yes: ["@maya", 15],
    no: ["@dev", 10],
    ends: "Fri 8:00 PM",
    settle: "Price oracle",
  },
  {
    feed: "BTC_USD",
    step: 1000,
    question: (t) => `BTC above ${t} by month end?`,
    yes: ["@sam", 50],
    no: ["@priya", 50],
    ends: "Oct 31",
    settle: "Price oracle",
  },
  {
    question: () => "Jordan runs a sub-25 minute 5K this month?",
    yes: ["@jordan", 20],
    no: ["@alex", 30],
    ends: "Oct 31",
    settle: "Both players agree",
  },
];

function threshold(prices: ClientPrices | null | undefined, feed?: FeedStr, step = 1) {
  if (!feed) return "";
  const raw = prices?.[feed]?.price;
  if (!raw) return "…";
  const usd = Number(raw) / 1e6;
  return `$${(Math.ceil((usd * 1.04) / step) * step).toLocaleString("en-US")}`;
}

function Markets() {
  const { data: prices } = usePrices();
  return (
    <section id="markets" className="scroll-mt-28 pt-8 pb-24 md:pb-32">
      <SectionHeading
        eyebrow="Markets"
        title="Anything you'd bet on. Settled."
        body="Crypto calls settle themselves off a live price oracle. Everything else settles when you both agree."
      />
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {EXAMPLES.map((ex) => (
          <MarketCard key={ex.question("")} ex={ex} t={threshold(prices, ex.feed, ex.step)} />
        ))}
      </div>
      <p className="mt-5 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
        Example bets · thresholds track the live price
      </p>
    </section>
  );
}

function MarketCard({ ex, t }: { ex: Example; t: string }) {
  const [yesName, yesStake] = ex.yes;
  const [noName, noStake] = ex.no;
  const pct = Math.round((yesStake / (yesStake + noStake)) * 100);
  return (
    <a
      href="#connect"
      className="group flex flex-col rounded-2xl border border-border/70 bg-card/60 p-5 backdrop-blur transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card/80"
    >
      <div className="flex items-start justify-between gap-4">
        <p className="text-lg leading-snug font-medium tracking-tight">{ex.question(t)}</p>
        <div className="text-right">
          <p className="text-2xl font-black tracking-tight tabular">{pct}%</p>
          <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">Yes</p>
        </div>
      </div>

      <div className="mt-5 flex h-1.5 overflow-hidden rounded-full bg-no/25">
        <div className="rounded-full bg-yes" style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <span className="flex items-center justify-between rounded-xl bg-yes/10 px-3 py-2.5 font-medium text-yes">
          Yes <span className="tabular text-foreground/80">{yesName} · ${yesStake}</span>
        </span>
        <span className="flex items-center justify-between rounded-xl bg-no/10 px-3 py-2.5 font-medium text-no">
          No <span className="tabular text-foreground/80">{noName} · ${noStake}</span>
        </span>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-4 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
        <span>Pot ${yesStake + noStake}</span>
        <span>{ex.settle}</span>
        <span className="flex items-center gap-1 text-foreground/70 transition-colors group-hover:text-brand-ink">
          {ex.ends} <ArrowUpRight className="size-3" />
        </span>
      </div>
    </a>
  );
}

/* ——— How it works ——— */

const STEPS: [LucideIcon, string, string][] = [
  [PenLine, "Say it in plain English", "Type the bet like you'd text it. AI turns it into precise terms you can edit."],
  [Handshake, "Haggle until it's fair", "Your friend accepts, declines, or counters with new stakes, sides or odds."],
  [Lock, "Lock it in escrow", "Both stakes go into a Solana program. Nobody can touch them mid-bet."],
  [Trophy, "Winner takes the pot", "An oracle or mutual agreement settles it, and the program pays out automatically."],
];

function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-28 pb-28 md:pb-36">
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
          <Wordmark slogan className="text-lg" sloganClassName="text-[9px]" />
        </div>
        <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
          Built on Solana · Devnet · Test money only
        </p>
      </div>
    </footer>
  );
}

/* ——— Small bits ——— */

function LiveDot() {
  return (
    <span className="relative flex size-1.5">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-70" />
      <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
    </span>
  );
}

function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "flex items-center gap-2 font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase",
        className,
      )}
    >
      <LiveDot /> {children}
    </p>
  );
}

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
