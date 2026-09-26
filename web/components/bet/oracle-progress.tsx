"use client";

import { Progress } from "@/components/ui/progress";
import { usePrices } from "@/hooks/use-prices";
import type { BetDTO } from "@/lib/bet-types";
import { FEED_LABEL, describeOracle } from "@/lib/bet-view";
import { formatPrice } from "@/lib/money";
import { cn } from "@/lib/utils";

/** Live price vs threshold. The bar shows how close the price is to flipping the outcome. */
export function OracleProgress({ bet, live }: { bet: BetDTO; live: boolean }) {
  const { data: prices } = usePrices(live && !!bet.oracle);
  if (!bet.oracle) return null;
  const o = bet.oracle;
  const p = prices?.[o.feed];
  const price = p ? Number(p.price) / 1e6 : null;
  const threshold = Number(o.threshold) / 1e6;
  const above = o.kind === "ABOVE_AT" || o.kind === "TOUCH_ABOVE";
  const yesNow = price != null ? (above ? price >= threshold : price <= threshold) : null;
  // Map ±5% around the threshold onto 0..100 so small moves are visible.
  const pct = price != null ? Math.max(2, Math.min(98, 50 + ((price - threshold) / threshold) * 1000)) : 50;

  return (
    <div className="rounded-3xl bg-card p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-sm text-muted-foreground">{FEED_LABEL[o.feed]} now</p>
        <p className="text-xs text-muted-foreground">target {formatPrice(o.threshold)}</p>
      </div>
      <p className="tabular text-3xl font-black">{p ? formatPrice(p.price) : "—"}</p>
      {live && (
        <>
          <Progress value={pct} className={cn("mt-3 h-2", yesNow ? "[&>*]:bg-yes" : "[&>*]:bg-no")} />
          <div className="mt-1 flex justify-between text-[11px] font-semibold text-muted-foreground">
            <span>{above ? "NO" : "YES"}</span>
            <span>|</span>
            <span>{above ? "YES" : "NO"}</span>
          </div>
          {yesNow != null && (
            <p className="mt-2 text-sm">
              Right now: <b className={yesNow ? "text-yes" : "text-no"}>{yesNow ? "YES" : "NO"}</b> is winning
            </p>
          )}
        </>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        {describeOracle(o)} · source: {p?.source === "pyth" ? "Pyth" : p ? "CoinGecko" : "…"}
      </p>
    </div>
  );
}
