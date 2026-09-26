"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { BetCard } from "@/components/bet/bet-card";
import { useNow } from "@/components/countdown";
import { EmptyState, SectionTitle } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { useGoSignIn } from "@/components/app-shell";
import { OpenBetsBoard, usePublicBets } from "@/components/bet/open-bets-board";
import { useViewer } from "@/hooks/use-session";
import { api } from "@/lib/api-client";
import type { BetDTO } from "@/lib/bet-types";
import { perspective } from "@/lib/bet-view";
import { formatUsd } from "@/lib/money";
import { cn } from "@/lib/utils";

interface Stats {
  record: { wins: number; losses: number; net: string };
  activeCount: number;
}

type Tab = "bets" | "public" | "settled";
const TAB_URL: Record<Tab, string> = { bets: "/home", public: "/home?tab=public", settled: "/home?tab=settled" };

/** Guests ("Check it out") land on the public board. */
function GuestHome() {
  const goSignIn = useGoSignIn();
  return (
    <>
      <header className="mb-5">
        <p className="text-sm text-muted-foreground">Welcome 👀</p>
        <p className="text-xl font-black md:text-3xl">See what people are betting on.</p>
      </header>
      <SectionTitle>🌍 Open bets anyone can take</SectionTitle>
      <OpenBetsBoard />
      <div className="mt-6 rounded-3xl bg-card p-5 text-center">
        <p className="font-bold">Think you know better?</p>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to take a bet, challenge friends and get free test money.</p>
        <Button size="lg" className="mt-4 h-12 w-full font-black md:w-auto md:px-10" onClick={goSignIn}>
          Sign in to bet
        </Button>
      </div>
    </>
  );
}

function Home() {
  const { me, isGuest } = useViewer();
  return isGuest ? <GuestHome /> : <MemberHome meId={me?.id} />;
}

function MemberHome({ meId }: { meId?: string }) {
  const { me } = useViewer();
  const router = useRouter();
  const tabParam = useSearchParams().get("tab");
  const tab: Tab = tabParam === "settled" || tabParam === "public" ? tabParam : "bets";
  const publicBets = usePublicBets();
  const takeable = (publicBets.data ?? []).filter((b) => b.creator.id !== meId).length;
  const now = useNow(5_000);
  const bets = useQuery({
    queryKey: ["bets", "all"],
    queryFn: () => api<{ bets: BetDTO[] }>("/api/bets?filter=all").then((r) => r.bets),
    refetchInterval: 5_000,
  });
  const stats = useQuery({ queryKey: ["stats"], enabled: !!me, queryFn: () => api<Stats>("/api/stats/me"), refetchInterval: 15_000 });

  const rows = (bets.data ?? []).map((b) => ({ bet: b, p: perspective(b, meId, now) }));
  const open = rows.filter((r) => !["SETTLED", "CANCELLED", "EXPIRED", "VOID"].includes(r.bet.state));
  const needsAction = open.filter((r) => r.p.action);
  const waiting = open.filter((r) => !r.p.action && ["PROPOSED", "ACCEPTED"].includes(r.bet.state));
  const live = open.filter((r) => !r.p.action && ["ACTIVE", "AWAITING_CONFIRMATION"].includes(r.bet.state));
  const done = rows.filter((r) => ["SETTLED", "CANCELLED", "EXPIRED", "VOID"].includes(r.bet.state));
  const net = stats.data ? BigInt(stats.data.record.net) : 0n;
  const inEscrow = open.reduce((sum, r) => sum + (r.p.myFunded ? r.p.myStake : 0n), 0n);

  return (
    <>
      <header className="mb-5 flex items-center gap-3">
        {me && <UserAvatar seed={me.avatarSeed} name={me.displayName ?? me.username} size={44} />}
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">Hey {me?.displayName ?? me?.username}</p>
          <p className="text-xl font-black md:text-3xl">Put up or shut up.</p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <div className="rounded-3xl bg-card p-4">
          <p className="text-xs text-muted-foreground">Net winnings</p>
          <p className={cn("tabular text-3xl font-black", net > 0n && "text-yes", net < 0n && "text-no")}>
            {stats.data ? formatUsd(net, { sign: true }) : "—"}
          </p>
        </div>
        <div className="rounded-3xl bg-card p-4">
          <p className="text-xs text-muted-foreground">Record</p>
          <p className="tabular text-3xl font-black">
            {stats.data ? `${stats.data.record.wins}-${stats.data.record.losses}` : "—"}
          </p>
        </div>
        <div className="hidden rounded-3xl bg-card p-4 md:block">
          <p className="text-xs text-muted-foreground">Open bets</p>
          <p className="tabular text-3xl font-black">{bets.data ? open.length : "—"}</p>
        </div>
        <div className="hidden rounded-3xl bg-card p-4 md:block">
          <p className="text-xs text-muted-foreground">You have in escrow</p>
          <p className="tabular text-3xl font-black">{bets.data ? formatUsd(inEscrow) : "—"}</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-1 rounded-2xl bg-muted p-1 md:mt-8 md:max-w-md">
        {(["bets", "public", "settled"] as const).map((t) => (
          <button
            key={t}
            onClick={() => router.replace(TAB_URL[t])}
            className={cn("rounded-xl py-2 text-sm font-bold", tab === t ? "bg-background shadow-sm" : "text-muted-foreground")}
          >
            {t === "bets" ? `Mine (${open.length})` : t === "public" ? `Public (${takeable})` : `History (${done.length})`}
          </button>
        ))}
      </div>

      {tab === "public" ? (
        <div className="mt-4">
          <p className="mb-3 text-sm text-muted-foreground">Open price bets from anyone. First to take one gets it.</p>
          <OpenBetsBoard meId={meId} />
        </div>
      ) : bets.isLoading ? (
        <div className="mt-6 grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-3xl" />
          ))}
        </div>
      ) : tab === "settled" ? (
        <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3">
          {done.length ? (
            done.map((r) => <BetCard key={r.bet.id} {...r} />)
          ) : (
            <EmptyState icon="" title="No history yet">
              Settled bets show up here.
            </EmptyState>
          )}
        </div>
      ) : (
        <>
          {needsAction.length > 0 && (
            <>
              <SectionTitle>🔥 Needs your action</SectionTitle>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3">
                {needsAction.map((r) => (
                  <BetCard key={r.bet.id} {...r} />
                ))}
              </div>
            </>
          )}
          {live.length > 0 && (
            <>
              <SectionTitle>Live bets</SectionTitle>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3">
                {live.map((r) => (
                  <BetCard key={r.bet.id} {...r} />
                ))}
              </div>
            </>
          )}
          {waiting.length > 0 && (
            <>
              <SectionTitle>Waiting on them</SectionTitle>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3">
                {waiting.map((r) => (
                  <BetCard key={r.bet.id} {...r} />
                ))}
              </div>
            </>
          )}
          {open.length === 0 && (
            <div className="mt-6">
              <EmptyState icon="" title="No open bets">
                Someone said something dumb today. Make them pay.
              </EmptyState>
              <Button asChild size="lg" className="mt-4 h-13 w-full font-black">
                <Link href="/new">
                  <Plus /> New bet
                </Link>
              </Button>
            </div>
          )}
          {done.length > 0 && (
            <>
              <SectionTitle
                right={
                  <Link href="/home?tab=settled" className="text-xs font-semibold text-muted-foreground">
                    See all
                  </Link>
                }
              >
                Recently settled
              </SectionTitle>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3">
                {done.slice(0, 3).map((r) => (
                  <BetCard key={r.bet.id} {...r} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Home />
    </Suspense>
  );
}
