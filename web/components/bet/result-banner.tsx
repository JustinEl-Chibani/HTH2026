"use client";

import confetti from "canvas-confetti";
import { ExternalLink } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import type { BetDTO } from "@/lib/bet-types";
import { holderOf, type Perspective } from "@/lib/bet-view";
import { formatDateTime } from "@/lib/format";
import { formatPrice, formatUsd } from "@/lib/money";
import { explorerTx } from "@/lib/solana/explorer";
import { cn } from "@/lib/utils";

export function ResultBanner({ bet, p }: { bet: BetDTO; p: Perspective }) {
  const fired = useRef(false);
  useEffect(() => {
    if (p.iWon && !fired.current) {
      fired.current = true;
      const end = Date.now() + 1200;
      const colors = ["#b6f03c", "#ffffff", "#3ff0c0", "#ffd23f"];
      (function frame() {
        confetti({ particleCount: 6, angle: 60, spread: 70, origin: { x: 0, y: 0.7 }, colors });
        confetti({ particleCount: 6, angle: 120, spread: 70, origin: { x: 1, y: 0.7 }, colors });
        if (Date.now() < end) requestAnimationFrame(frame);
      })();
    }
  }, [p.iWon]);

  if (bet.state === "SETTLED" && bet.winnerSide) {
    const winner = holderOf(bet, bet.winnerSide);
    const settleEvent = bet.events?.findLast((e) => e.type === "SETTLED");
    const src = settleEvent?.data?.source as string | undefined;
    return (
      <div className={cn("animate-pop rounded-3xl p-5 text-center", p.iWon ? "bg-primary text-primary-foreground" : "bg-card")}>
        <p className="text-5xl">{p.iWon ? "🏆" : p.isParticipant ? "💸" : "🏁"}</p>
        <p className="mt-2 text-3xl font-black">
          {p.iWon ? "You won!" : p.isParticipant ? "You lost this one" : `${winner?.displayName ?? winner?.username} won`}
        </p>
        <p className="tabular mt-1 text-lg font-bold">
          {formatUsd(p.pot)} → {winner?.displayName ?? `@${winner?.username}`}
        </p>
        {bet.resolvedValue && (
          <p className={cn("mt-2 text-sm", p.iWon ? "opacity-80" : "text-muted-foreground")}>
            Resolved by {src === "pyth" ? "Pyth" : src === "coingecko" ? "CoinGecko" : "the oracle"}:{" "}
            {bet.oracle ? `${bet.oracle.feed.split("_")[0]} = ` : ""}
            {formatPrice(bet.resolvedValue)}
            {settleEvent && ` at ${formatDateTime(settleEvent.createdAt)}`}
          </p>
        )}
        {bet.finalTxSig && (
          <Button asChild variant={p.iWon ? "secondary" : "default"} className="mt-4 h-11 font-bold">
            <a href={explorerTx(bet.finalTxSig)} target="_blank" rel="noreferrer">
              View payout on Solana <ExternalLink />
            </a>
          </Button>
        )}
      </div>
    );
  }

  const copy: Partial<Record<BetDTO["state"], [string, string]>> = {
    CANCELLED: ["🚫", "Called off before it started. No money moved."],
    EXPIRED: ["⌛", "Expired. Anything that was funded has been refunded."],
    VOID: ["↩️", "Voided. Both sides got their money back."],
  };
  const c = copy[bet.state];
  if (!c) return null;
  return (
    <div className="rounded-3xl bg-card p-5 text-center">
      <p className="text-4xl">{c[0]}</p>
      <p className="mt-2 text-sm text-muted-foreground">{c[1]}</p>
      {bet.finalTxSig && (
        <a className="mt-2 inline-flex items-center gap-1 text-xs underline" href={explorerTx(bet.finalTxSig)} target="_blank" rel="noreferrer">
          View on Solana <ExternalLink className="size-3" />
        </a>
      )}
    </div>
  );
}
