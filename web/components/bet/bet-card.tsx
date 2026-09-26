"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { SideBadge, StateBadge } from "@/components/bet/badges";
import { Countdown } from "@/components/countdown";
import { UserAvatar } from "@/components/user-avatar";
import type { BetDTO } from "@/lib/bet-types";
import type { Perspective } from "@/lib/bet-view";
import { formatUsd } from "@/lib/money";
import { cn } from "@/lib/utils";

const ACTION_COPY: Record<NonNullable<Perspective["action"]>, (b: BetDTO) => string> = {
  RESPOND: (b) => (b.version > 1 ? `Counteroffer v${b.version} — your move` : "New challenge — accept or counter"),
  FUND: () => "Fund your side",
  CONFIRM_OUTCOME: (b) => (b.proposedWinner === "VOID" ? "Confirm calling it off" : "Confirm the result"),
  REPORT_RESULT: () => "Deadline passed — who won?",
  REFUND: () => "Timed out — refund",
  TAKE: () => "Open to anyone — take it",
  CLOSE_PUBLIC: () => "Nobody took it — close it",
};

export function BetCard({ bet, p }: { bet: BetDTO; p: Perspective }) {
  // Browsing someone else's public bet: show who posted it.
  const them = p.them ?? (p.isParticipant ? null : bet.creator);
  const vsLabel = p.isOpenPublic && p.isCreator ? "Open to anyone" : `vs ${them?.displayName ?? `@${them?.username}`}`;
  const live = bet.state === "ACTIVE" && Date.parse(bet.eventDeadline) > Date.now();
  return (
    <Link
      href={`/bet/${bet.id}`}
      className={cn(
        "flex items-center gap-3 rounded-3xl bg-card p-4 transition-transform active:scale-[0.99]",
        p.action && "ring-1 ring-primary/50",
      )}
    >
      {them ? (
        <UserAvatar seed={them.avatarSeed} name={them.displayName ?? them.username} size={44} />
      ) : (
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-muted text-xl">🌍</span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{bet.title}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
          {vsLabel} ·{p.mySide && <SideBadge side={p.mySide} />}
          <span className="tabular">
            {formatUsd(p.myStake)} → {formatUsd(p.pot)}
          </span>
        </p>
        {p.action ? (
          <p className="mt-1 text-xs font-bold text-brand-ink">{ACTION_COPY[p.action](bet)}</p>
        ) : live ? (
          <p className="mt-1 text-xs text-muted-foreground">
            ⏱ <Countdown to={bet.eventDeadline} />
          </p>
        ) : bet.state === "SETTLED" ? (
          <p className={cn("mt-1 text-xs font-bold", p.iWon ? "text-yes" : "text-no")}>
            {p.iWon ? `Won ${formatUsd(p.theirStake)}` : `Lost ${formatUsd(p.myStake)}`}
          </p>
        ) : p.waitingOnThem ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {p.isOpenPublic ? "Waiting for someone to take it…" : `Waiting on ${them?.displayName ?? them?.username}…`}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col items-end gap-2">
        <StateBadge state={bet.state} />
        <ChevronRight className="size-4 text-muted-foreground" />
      </div>
    </Link>
  );
}
