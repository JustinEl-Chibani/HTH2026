"use client";

import { useQuery } from "@tanstack/react-query";
import { BetCard } from "@/components/bet/bet-card";
import { useNow } from "@/components/countdown";
import { EmptyState } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import type { BetDTO } from "@/lib/bet-types";
import { perspective } from "@/lib/bet-view";

export function usePublicBets() {
  return useQuery({
    queryKey: ["bets", "public"],
    queryFn: () => api<{ bets: BetDTO[] }>("/api/bets?filter=public").then((r) => r.bets),
    refetchInterval: 8_000,
  });
}

/** Open price bets anyone signed in can take. Guests see the same board, view-only. */
export function OpenBetsBoard({ meId }: { meId?: string }) {
  const { data, isLoading } = usePublicBets();
  const now = useNow(5_000);
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-24 rounded-3xl" />
        ))}
      </div>
    );
  }
  if (!data?.length) {
    return (
      <EmptyState icon="" title="No open bets right now">
        Make a price bet and set it to &ldquo;Anyone&rdquo; to post it here.
      </EmptyState>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3">
      {data.map((bet) => (
        <BetCard key={bet.id} bet={bet} p={perspective(bet, meId, now)} />
      ))}
    </div>
  );
}
