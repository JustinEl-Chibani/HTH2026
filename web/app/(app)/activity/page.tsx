"use client";

import { GuestNotice } from "@/components/guest-notice";
import { useViewer } from "@/hooks/use-session";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect } from "react";
import { EmptyState, PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
  bet: { id: string; title: string; state: string } | null;
}

const ICONS: Record<string, string> = {
  FRIEND_REQUEST: "👋",
  FRIEND_ACCEPTED: "🤝",
  CHALLENGE: "⚔️",
  COUNTER: "🔁",
  ACCEPTED: "✅",
  FUNDED: "💰",
  ACTIVE: "🔒",
  OUTCOME_PROPOSED: "🧑‍⚖️",
  OUTCOME_REJECTED: "🙅",
  WON: "🏆",
  LOST: "💸",
  CANCELLED: "🚫",
  EXPIRED: "⌛",
  VOID: "↩️",
};

function ActivityPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<{ unread: number; notifications: Notification[] }>("/api/notifications"),
    refetchInterval: 8_000,
  });

  const unread = data?.unread ?? 0;
  useEffect(() => {
    if (!unread) return;
    // Leave the highlight on screen for a moment, then clear the badge.
    const t = setTimeout(async () => {
      await api("/api/notifications/read", { body: {} });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    }, 1500);
    return () => clearTimeout(t);
  }, [unread, qc]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Activity" subtitle="Challenges, counteroffers, payouts." />
      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : data?.notifications.length ? (
        <ul className="space-y-2">
          {data.notifications.map((n) => {
            const body = (
              <div
                className={cn(
                  "flex items-start gap-3 rounded-2xl bg-card p-3 transition-colors",
                  !n.read && "ring-1 ring-primary/50",
                )}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-xl">
                  {ICONS[n.type] ?? "🔔"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug font-medium">{n.message}</p>
                  {n.bet && <p className="mt-0.5 truncate text-xs text-muted-foreground">{n.bet.title}</p>}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(n.createdAt)}</span>
              </div>
            );
            return (
              <li key={n.id}>
                {n.bet ? <Link href={`/bet/${n.bet.id}`}>{body}</Link> : body}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon="" title="All quiet">
          Challenge a friend and things will start happening here.
        </EmptyState>
      )}
    </div>
  );
}

export default function Page() {
  const { isGuest } = useViewer();
  if (isGuest) {
    return (
      <GuestNotice title="Activity" icon="🔔">
        Challenges, counteroffers and payouts show up here once you have an account.
      </GuestNotice>
    );
  }
  return <ActivityPage />;
}
