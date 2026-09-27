"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Share2 } from "lucide-react";
import Link from "next/link";
import { use } from "react";
import { toast } from "sonner";
import { ActionPanel } from "@/components/bet/action-panel";
import { StateBadge } from "@/components/bet/badges";
import { FaceOff } from "@/components/bet/face-off";
import { OracleProgress } from "@/components/bet/oracle-progress";
import { ResultBanner } from "@/components/bet/result-banner";
import { ActivityTimeline, NegotiationTimeline } from "@/components/bet/timelines";
import { useNow } from "@/components/countdown";
import { SectionTitle } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useBetActions } from "@/hooks/use-bet-actions";
import { useGoSignIn } from "@/components/app-shell";
import { useViewer } from "@/hooks/use-session";
import { api } from "@/lib/api-client";
import type { BetDTO } from "@/lib/bet-types";
import { describeOracle, perspective } from "@/lib/bet-view";
import { formatDateTime } from "@/lib/format";
import { explorerAddress } from "@/lib/solana/explorer";
import { TERMINAL_STATES } from "@/lib/solana/codec";

export default function BetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { me, isGuest } = useViewer();
  const goSignIn = useGoSignIn();
  const actions = useBetActions();
  const now = useNow(1000);
  const { data: bet, error } = useQuery({
    queryKey: ["bet", id],
    queryFn: () => api<{ bet: BetDTO }>(`/api/bets/${id}/refresh`, { body: {} }).then((r) => r.bet),
    refetchInterval: (q) => (q.state.data && TERMINAL_STATES.includes(q.state.data.state) ? false : 3_000),
  });

  if (error) {
    return (
      <div className="pt-20 text-center">
                <p className="mt-3 font-bold">Couldn&apos;t find that bet.</p>
        <Button asChild variant="link">
          <Link href="/home">Back home</Link>
        </Button>
      </div>
    );
  }
  if (!bet) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-44 rounded-3xl" />
        <Skeleton className="h-32 rounded-3xl" />
      </div>
    );
  }

  const p = perspective(bet, me?.id, now);
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: bet.title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      /* share sheet dismissed */
    }
  };

  return (
    <div className="md:grid md:grid-cols-[minmax(0,1fr)_380px] md:items-start md:gap-8">
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="icon" className="-ml-2">
          <Link href="/home" aria-label="Back">
            <ArrowLeft />
          </Link>
        </Button>
        <StateBadge state={bet.state} />
        <Button variant="ghost" size="icon" className="-mr-2" onClick={share} aria-label="Share">
          <Share2 />
        </Button>
      </div>

      <div>
        <h1 className="text-3xl leading-tight font-black tracking-tight">{bet.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-semibold text-yes">YES</span> means: {bet.conditionText}
        </p>
      </div>

      <FaceOff bet={bet} meId={me?.id} />

      <ResultBanner bet={bet} p={p} />
      <ActionPanel bet={bet} p={p} actions={actions} isGuest={isGuest} onSignIn={goSignIn} />

      {bet.oracle && !["ACTIVE"].includes(bet.state) && !TERMINAL_STATES.includes(bet.state) && (
        <OracleProgress bet={bet} live={false} />
      )}

      <div className="rounded-3xl bg-card p-4 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">Decided by</span>
          <span className="text-right font-semibold">{bet.oracle ? `Price oracle: ${describeOracle(bet.oracle)}` : "Mutual agreement"}</span>
        </div>
        <div className="mt-2 flex justify-between gap-3">
          <span className="text-muted-foreground">Deadline</span>
          <span className="font-semibold">{formatDateTime(bet.eventDeadline)}</span>
        </div>
        <a
          href={explorerAddress(bet.betPda)}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-muted py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          View on Solana <ExternalLink className="size-3" />
        </a>
      </div>
    </div>

    {/* Desktop: history in a sticky side column. Mobile: stacked below. */}
    <aside className="md:sticky md:top-24 md:rounded-3xl md:border md:border-border/60 md:p-5 md:[&>div:first-child]:mt-0">
      {!!bet.versions?.length && (
        <>
          <SectionTitle>Negotiation</SectionTitle>
          <NegotiationTimeline bet={bet} />
        </>
      )}
      {!!bet.events?.length && (
        <>
          <SectionTitle>Activity</SectionTitle>
          <ActivityTimeline bet={bet} />
        </>
      )}
    </aside>
    </div>
  );
}
