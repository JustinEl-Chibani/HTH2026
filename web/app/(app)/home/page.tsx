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
import { useMe } from "@/hooks/use-session";
import { api } from "@/lib/api-client";
import type { BetDTO } from "@/lib/bet-types";
import { perspective } from "@/lib/bet-view";
import { formatUsd } from "@/lib/money";
import { cn } from "@/lib/utils";

interface Stats {
  record: { wins: number; losses: number; net: string };
  activeCount: number;
}

function Home() {
  const { data: me } = useMe();
  const router = useRouter();
  const tab = useSearchParams().get("tab") === "settled" ? "settled" : "bets";
  const now = useNow(5_000);
  const bets = useQuery({
    queryKey: ["bets", "all"],
    queryFn: () => api<{ bets: BetDTO[] }>("/api/bets?filter=all").then((r) => r.bets),
    refetchInterval: 3_000,
  });
  const stats = useQuery({ queryKey: ["stats"], queryFn: () => api<Stats>("/api/stats/me"), refetchInterval: 10_000 });

  const rows = (bets.data ?? []).map((b) => ({ bet: b, p: perspective(b, me?.id, now) }));
  const open = rows.filter((r) => !["SETTLED", "CANCELLED", "EXPIRED", "VOID"].includes(r.bet.state));
  const needsAction = open.filter((r) => r.p.action);
  const waiting = open.filter((r) => !r.p.action && ["PROPOSED", "ACCEPTED"].includes(r.bet.state));
  const live = open.filter((r) => !r.p.action && ["ACTIVE", "AWAITING_CONFIRMATION"].includes(r.bet.state));
  const done = rows.filter((r) => ["SETTLED", "CANCELLED", "EXPIRED", "VOID"].includes(r.bet.state));
  const net = stats.data ? BigInt(stats.data.record.net) : 0n;

  return (
    <>
      <header className="mb-5 flex items-center gap-3">
        {me && <UserAvatar seed={me.avatarSeed} name={me.displayName ?? me.username} size={44} />}
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">Hey {me?.displayName ?? me?.username} 👋</p>
          <p className="text-xl font-black">Put up or shut up.</p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2">
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
      </div>

      <div className="mt-5 grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1">
        {(["bets", "settled"] as const).map((t) => (
          <button
            key={t}
            onClick={() => router.replace(t === "bets" ? "/home" : "/home?tab=settled")}
            className={cn("rounded-xl py-2 text-sm font-bold", tab === t ? "bg-background shadow-sm" : "text-muted-foreground")}
          >
            {t === "bets" ? `Open (${open.length})` : `History (${done.length})`}
          </button>
        ))}
      </div>

      {bets.isLoading ? (
        <div className="mt-6 space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-3xl" />
          ))}
        </div>
      ) : tab === "settled" ? (
        <div className="mt-4 space-y-2">
          {done.length ? (
            done.map((r) => <BetCard key={r.bet.id} {...r} />)
          ) : (
            <EmptyState icon="📜" title="No history yet">
              Settled bets show up here.
            </EmptyState>
          )}
        </div>
      ) : (
        <>
          {needsAction.length > 0 && (
            <>
              <SectionTitle>🔥 Needs your action</SectionTitle>
              <div className="space-y-2">
                {needsAction.map((r) => (
                  <BetCard key={r.bet.id} {...r} />
                ))}
              </div>
            </>
          )}
          {live.length > 0 && (
            <>
              <SectionTitle>Live bets</SectionTitle>
              <div className="space-y-2">
                {live.map((r) => (
                  <BetCard key={r.bet.id} {...r} />
                ))}
              </div>
            </>
          )}
          {waiting.length > 0 && (
            <>
              <SectionTitle>Waiting on them</SectionTitle>
              <div className="space-y-2">
                {waiting.map((r) => (
                  <BetCard key={r.bet.id} {...r} />
                ))}
              </div>
            </>
          )}
          {open.length === 0 && (
            <div className="mt-6">
              <EmptyState icon="💸" title="No open bets">
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
              <div className="space-y-2">
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
