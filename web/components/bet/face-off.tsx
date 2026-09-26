import { Check } from "lucide-react";
import { SideBadge } from "@/components/bet/badges";
import { UserAvatar } from "@/components/user-avatar";
import type { BetDTO, UserDTO } from "@/lib/bet-types";
import { opposite } from "@/lib/bet-view";
import { formatUsd } from "@/lib/money";
import type { SideStr } from "@/lib/solana/codec";
import { cn } from "@/lib/utils";

function Fighter({
  user,
  side,
  stake,
  funded,
  showFunding,
  winner,
  loser,
  isMe,
}: {
  user: UserDTO | null;
  side: SideStr;
  stake: string;
  funded: boolean;
  showFunding: boolean;
  winner: boolean;
  loser: boolean;
  isMe: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-1 flex-col items-center gap-2 rounded-3xl bg-card p-4 text-center transition-all",
        winner && "ring-2 ring-primary",
        loser && "opacity-50",
      )}
    >
      {winner && <span className="absolute -top-3 text-2xl">👑</span>}
      {user ? (
        <UserAvatar seed={user.avatarSeed} name={user.displayName ?? user.username} size={56} />
      ) : (
        <div className="grid size-14 place-items-center rounded-full bg-muted text-2xl">🌍</div>
      )}
      <div className="min-w-0">
        <p className="truncate font-bold">
          {user?.displayName ?? user?.username ?? "Anyone"}
          {isMe && <span className="text-muted-foreground"> (you)</span>}
        </p>
        <SideBadge side={side} className="mt-1" />
      </div>
      <p className="tabular text-2xl font-black">{formatUsd(stake)}</p>
      {showFunding && (
        <p className={cn("flex items-center gap-1 text-xs font-semibold", funded ? "text-yes" : "text-muted-foreground")}>
          {funded ? <Check className="size-3.5" /> : <span className="size-2 rounded-full border border-current" />}
          {funded ? "Funded" : "Not funded"}
        </p>
      )}
    </div>
  );
}

export function FaceOff({ bet, meId }: { bet: BetDTO; meId?: string }) {
  const pot = BigInt(bet.creatorStake) + BigInt(bet.opponentStake);
  const showFunding = ["ACCEPTED", "ACTIVE", "AWAITING_CONFIRMATION"].includes(bet.state);
  const settled = bet.state === "SETTLED" && bet.winnerSide;
  const creatorWon = settled && bet.winnerSide === bet.creatorSide;
  const oppSide = opposite(bet.creatorSide);
  return (
    <div className="relative flex items-stretch gap-3">
      <Fighter
        user={bet.creator}
        side={bet.creatorSide}
        stake={bet.creatorStake}
        funded={bet.creatorFunded}
        showFunding={showFunding}
        winner={!!settled && !!creatorWon}
        loser={!!settled && !creatorWon}
        isMe={bet.creator.id === meId}
      />
      <div className="absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-primary px-3 py-2 text-center text-primary-foreground shadow-lg ring-4 ring-background">
        <p className="text-[10px] font-black tracking-widest uppercase opacity-70">Pot</p>
        <p className="tabular text-lg leading-none font-black">{formatUsd(pot)}</p>
      </div>
      <Fighter
        user={bet.opponent}
        side={oppSide}
        stake={bet.opponentStake}
        funded={bet.opponentFunded}
        showFunding={showFunding}
        winner={!!settled && !creatorWon}
        loser={!!settled && !!creatorWon}
        isMe={bet.opponent?.id === meId}
      />
    </div>
  );
}
