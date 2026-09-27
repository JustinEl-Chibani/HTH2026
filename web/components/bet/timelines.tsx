import { ExternalLink } from "lucide-react";
import { SideBadge } from "@/components/bet/badges";
import type { BetDTO, UserDTO } from "@/lib/bet-types";
import { opposite } from "@/lib/bet-view";
import { formatDateTime, timeAgo } from "@/lib/format";
import { formatPrice, formatUsd } from "@/lib/money";
import { sourceLabel } from "@/lib/price-labels";
import { explorerTx } from "@/lib/solana/explorer";
import { cn } from "@/lib/utils";

const nameOf = (bet: BetDTO, id: string | null) => {
  const u: UserDTO | null = id === bet.creator.id ? bet.creator : id === bet.opponent?.id ? bet.opponent : null;
  return u ? (u.displayName ?? `@${u.username}`) : "SolMog";
};

function TxLink({ sig }: { sig: string | null }) {
  if (!sig) return null;
  return (
    <a href={explorerTx(sig)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground">
      tx <ExternalLink className="size-3" />
    </a>
  );
}

/** Every version of the offer: v1, v2, v3… with who proposed what. */
export function NegotiationTimeline({ bet }: { bet: BetDTO }) {
  const versions = bet.versions ?? [];
  if (!versions.length) return null;
  return (
    <ol className="relative space-y-3 border-l-2 border-border pl-5">
      {versions.map((v) => {
        const current = v.version === bet.version;
        const accepted = current && !["PROPOSED", "CANCELLED", "EXPIRED"].includes(bet.state);
        return (
          <li key={v.version} className="relative">
            <span
              className={cn(
                "absolute top-1 -left-[1.72rem] grid size-5 place-items-center rounded-full text-[10px] font-black",
                current ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {v.version}
            </span>
            <div className={cn("rounded-2xl p-3", current ? "bg-card ring-1 ring-primary/40" : "bg-card/60")}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold">
                  v{v.version} · {nameOf(bet, v.proposerId)} {v.version === 1 ? "proposed" : "countered"}
                </p>
                <TxLink sig={v.txSig} />
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm">
                {bet.creator.displayName ?? bet.creator.username} <SideBadge side={v.creatorSide} /> {formatUsd(v.creatorStake)}
                <span className="text-muted-foreground">vs</span>
                {bet.opponent?.displayName ?? bet.opponent?.username} <SideBadge side={opposite(v.creatorSide)} /> {formatUsd(v.opponentStake)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {timeAgo(v.createdAt)}
                {accepted && " · accepted"}
                {current && bet.state === "PROPOSED" && " · on the table"}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const EVENT_TEXT: Record<string, (bet: BetDTO, e: NonNullable<BetDTO["events"]>[number]) => string> = {
  CREATED: (b, e) => `${nameOf(b, e.actorId)} sent the challenge`,
  COUNTERED: (b, e) => `${nameOf(b, e.actorId)} countered (v${e.data?.version ?? "?"})`,
  ACCEPTED: (b, e) => `${nameOf(b, e.actorId)} accepted v${e.data?.version ?? ""}`,
  FUNDED: (b, e) => `${nameOf(b, e.actorId)} locked ${formatUsd(String(e.data?.amount ?? 0))}`,
  ACTIVE: (_b, e) => `Both sides in — ${formatUsd(String(e.data?.pot ?? 0))} in escrow`,
  OUTCOME_PROPOSED: (b, e) =>
    e.data?.outcome === "VOID" ? `${nameOf(b, e.actorId)} proposed calling it off` : `${nameOf(b, e.actorId)} said ${e.data?.outcome} won`,
  OUTCOME_REJECTED: (b, e) => `${nameOf(b, e.actorId)} disputed the result`,
  SETTLED: (b, e) => {
    const price = e.data?.resolvedValue ? ` at ${formatPrice(String(e.data.resolvedValue))}` : "";
    const src = e.data?.source ? ` (${sourceLabel(String(e.data.source))})` : "";
    return `${nameOf(b, String(e.data?.winnerId ?? ""))} won ${formatUsd(String(e.data?.amount ?? 0))}${price}${src}`;
  },
  CANCELLED: () => "Called off",
  EXPIRED: () => "Expired — any funds refunded",
  VOID: () => "Voided — both sides refunded",
};

export function ActivityTimeline({ bet }: { bet: BetDTO }) {
  const events = bet.events ?? [];
  if (!events.length) return null;
  return (
    <ul className="space-y-2">
      {[...events].reverse().map((e) => (
        <li key={e.id} className="flex items-start justify-between gap-3 text-sm">
          <span>{EVENT_TEXT[e.type]?.(bet, e) ?? e.type}</span>
          <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground" title={formatDateTime(e.createdAt)}>
            {timeAgo(e.createdAt)} <TxLink sig={e.txSig} />
          </span>
        </li>
      ))}
    </ul>
  );
}
