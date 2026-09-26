"use client";

import { SectionTitle } from "@/components/page-header";
import { usePrices, type ClientPrices } from "@/hooks/use-prices";
import type { FeedStr } from "@/lib/solana/codec";

/** Illustrative bets (not real) shown to people with no open bets yet. Crypto thresholds track the live price. */
export function ExampleBets() {
  const { data: prices } = usePrices();
  return (
    <>
      <SectionTitle>Example bets</SectionTitle>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3 md:gap-3">
        {EXAMPLES.map((ex) => (
          <MarketCard key={ex.question("")} ex={ex} t={threshold(prices, ex.feed, ex.step)} />
        ))}
      </div>
    </>
  );
}

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

function MarketCard({ ex, t }: { ex: Example; t: string }) {
  const [yesName, yesStake] = ex.yes;
  const [noName, noStake] = ex.no;
  const pct = Math.round((yesStake / (yesStake + noStake)) * 100);
  return (
    <div className="flex flex-col rounded-2xl border border-border/70 bg-card/60 p-5 backdrop-blur">
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
        <span className="text-foreground/70">{ex.ends}</span>
      </div>
    </div>
  );
}
