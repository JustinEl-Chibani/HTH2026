import type { BetDTO } from "@/lib/bet-types";
import { STATE_LABEL } from "@/lib/bet-view";
import type { SideStr } from "@/lib/solana/codec";
import { cn } from "@/lib/utils";

const STATE_STYLE: Record<BetDTO["state"], string> = {
  DRAFT: "bg-muted text-muted-foreground",
  PROPOSED: "bg-sky-500/15 text-sky-600 dark:text-sky-300",
  ACCEPTED: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  ACTIVE: "bg-primary/20 text-brand-ink",
  AWAITING_CONFIRMATION: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  SETTLED: "bg-foreground/10 text-foreground",
  CANCELLED: "bg-muted text-muted-foreground",
  EXPIRED: "bg-muted text-muted-foreground",
  VOID: "bg-muted text-muted-foreground",
};

export function StateBadge({ state, className }: { state: BetDTO["state"]; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold",
        STATE_STYLE[state],
        className,
      )}
    >
      {state === "ACTIVE" && <span className="size-1.5 animate-pulse rounded-full bg-current" />}
      {STATE_LABEL[state]}
    </span>
  );
}

export function SideBadge({ side, className }: { side: SideStr; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-black tracking-wider",
        side === "YES" ? "bg-yes/15 text-yes" : "bg-no/15 text-no",
        className,
      )}
    >
      {side}
    </span>
  );
}
