"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatUsd, unitsToNumber, usdToUnits } from "@/lib/money";
import { americanFromStakes, formatAmerican, opponentStakeFromOdds, payoutFor } from "@/lib/odds";
import type { SideStr } from "@/lib/solana/codec";
import { cn } from "@/lib/utils";

export type StakeMode = "even" | "custom" | "odds";

export interface StakeValue {
  side: SideStr;
  myStake: bigint;
  theirStake: bigint;
  mode: StakeMode;
  odds: number | null;
}

function parseUsd(s: string): bigint | null {
  try {
    const v = usdToUnits(s);
    return v > 0n ? v : null;
  } catch {
    return null;
  }
}

const fmtInput = (u: bigint) => String(unitsToNumber(u));

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: React.ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-2xl bg-muted p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-xl px-3 py-2 text-sm font-bold transition-all",
            value === o.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function PayoutLine({ myStake, theirStake }: { myStake: bigint; theirStake: bigint }) {
  const p = payoutFor(myStake, theirStake);
  return (
    <div className="rounded-2xl bg-primary/10 p-3 text-sm">
      <p>
        You risk <b>{formatUsd(p.risk)}</b> to win <b className="text-brand-ink">{formatUsd(p.toWin)}</b>
      </p>
      <p className="mt-0.5 text-muted-foreground">
        Pot {formatUsd(p.pot)} · Implied probability {Math.round(p.probability * 100)}% · Odds{" "}
        {formatAmerican(americanFromStakes(myStake, theirStake))}
      </p>
    </div>
  );
}

/** Side + stakes editor with Even / Custom / Odds modes. Always emits a consistent pair of stakes. */
export function StakeEditor({
  value,
  onChange,
  themName,
  sideLabels,
}: {
  value: StakeValue;
  onChange: (v: StakeValue) => void;
  themName: string;
  sideLabels?: { YES: string; NO: string };
}) {
  const [mine, setMine] = useState(fmtInput(value.myStake));
  const [theirs, setTheirs] = useState(fmtInput(value.theirStake));
  const [odds, setOdds] = useState(value.odds ? formatAmerican(value.odds) : "+100");

  const recompute = (next: Partial<{ mine: string; theirs: string; odds: string; mode: StakeMode }>) => {
    const m = next.mine ?? mine;
    const mode = next.mode ?? value.mode;
    const my = parseUsd(m);
    if (!my) {
      onChange({ ...value, mode, myStake: 0n });
      return;
    }
    if (mode === "even") {
      onChange({ ...value, mode, myStake: my, theirStake: my, odds: null });
    } else if (mode === "custom") {
      const t = parseUsd(next.theirs ?? theirs) ?? 0n;
      onChange({ ...value, mode, myStake: my, theirStake: t, odds: null });
    } else {
      const o = Number((next.odds ?? odds).replace(/\s/g, ""));
      const valid = Number.isInteger(o) && Math.abs(o) >= 100;
      onChange({ ...value, mode, myStake: my, theirStake: valid ? opponentStakeFromOdds(my, o) : 0n, odds: valid ? o : null });
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Your side</Label>
        <Segmented<SideStr>
          value={value.side}
          onChange={(side) => onChange({ ...value, side })}
          options={[
            { value: "YES", label: <span className={value.side === "YES" ? "text-yes" : ""}>{sideLabels?.YES ?? "YES"}</span> },
            { value: "NO", label: <span className={value.side === "NO" ? "text-no" : ""}>{sideLabels?.NO ?? "NO"}</span> },
          ]}
        />
      </div>

      <div className="space-y-2">
        <Label>Stakes</Label>
        <Segmented<StakeMode>
          value={value.mode}
          onChange={(mode) => recompute({ mode })}
          options={[
            { value: "even", label: "Even" },
            { value: "custom", label: "Custom" },
            { value: "odds", label: "Odds" },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="my-stake" className="text-xs text-muted-foreground">
            You put in
          </Label>
          <div className="relative">
            <span className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">$</span>
            <Input
              id="my-stake"
              inputMode="decimal"
              className="h-12 pl-7 text-lg font-bold"
              value={mine}
              onChange={(e) => {
                setMine(e.target.value);
                recompute({ mine: e.target.value });
              }}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="their-stake" className="truncate text-xs text-muted-foreground">
            {value.mode === "odds" ? "Odds (American)" : `${themName} puts in`}
          </Label>
          {value.mode === "odds" ? (
            <Input
              id="their-stake"
              className="h-12 text-lg font-bold"
              value={odds}
              onChange={(e) => {
                setOdds(e.target.value);
                recompute({ odds: e.target.value });
              }}
              placeholder="+150"
            />
          ) : (
            <div className="relative">
              <span className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="their-stake"
                inputMode="decimal"
                className="h-12 pl-7 text-lg font-bold"
                disabled={value.mode === "even"}
                value={value.mode === "even" ? mine : theirs}
                onChange={(e) => {
                  setTheirs(e.target.value);
                  recompute({ theirs: e.target.value });
                }}
              />
            </div>
          )}
        </div>
      </div>
      {value.mode === "odds" && value.theirStake > 0n && (
        <p className="-mt-2 text-xs text-muted-foreground">
          {themName} puts in {formatUsd(value.theirStake)}
        </p>
      )}

      {value.myStake > 0n && value.theirStake > 0n ? (
        <PayoutLine myStake={value.myStake} theirStake={value.theirStake} />
      ) : (
        <p className="rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">Enter amounts above $0 for both sides.</p>
      )}
    </div>
  );
}
