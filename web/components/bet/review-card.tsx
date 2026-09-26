"use client";

import { AlertTriangle, Loader2, Send } from "lucide-react";
import { StakeEditor } from "@/components/bet/stake-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user-avatar";
import type { ClientPrices } from "@/hooks/use-prices";
import type { UserDTO } from "@/lib/bet-types";
import { FEED_LABEL } from "@/lib/bet-view";
import { toLocalInput, type DraftForm } from "@/lib/draft";
import { formatDateTime } from "@/lib/format";
import { formatPrice } from "@/lib/money";
import type { ConditionStr, FeedStr } from "@/lib/solana/codec";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<ConditionStr, string> = {
  ABOVE_AT: "is above at the deadline",
  BELOW_AT: "is below at the deadline",
  TOUCH_ABOVE: "hits (any time before)",
  TOUCH_BELOW: "drops to (any time before)",
};

const QUICK_DEADLINES: { label: string; at: () => Date }[] = [
  { label: "3 min", at: () => new Date(Date.now() + 3 * 60_000) },
  { label: "1 hour", at: () => new Date(Date.now() + 3600_000) },
  {
    label: "Tonight",
    at: () => {
      const d = new Date();
      d.setHours(23, 59, 0, 0);
      return d.getTime() - Date.now() < 5 * 60_000 ? new Date(d.getTime() + 86400_000) : d;
    },
  },
  {
    label: "Tomorrow",
    at: () => {
      const d = new Date(Date.now() + 86400_000);
      d.setHours(20, 0, 0, 0);
      return d;
    },
  },
  { label: "1 week", at: () => new Date(Date.now() + 7 * 86400_000) },
];

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export function ReviewCard({
  form,
  setForm,
  friends,
  prices,
  sending,
  onSend,
  stakeKey,
}: {
  form: DraftForm;
  setForm: (f: DraftForm) => void;
  friends: UserDTO[];
  prices: ClientPrices | null | undefined;
  sending: boolean;
  onSend: () => void;
  stakeKey: number;
}) {
  const set = <K extends keyof DraftForm>(k: K, v: DraftForm[K]) => setForm({ ...form, [k]: v });
  const opponent = friends.find((f) => f.username === form.opponentUsername);
  // Public bets are price-oracle only; "we agree" bets always go to a friend.
  const isPublic = form.isPublic && form.resolution === "ORACLE";
  const themName = isPublic
    ? "The taker"
    : (opponent?.displayName ?? (form.opponentUsername ? `@${form.opponentUsername}` : "They"));
  const livePrice = prices?.[form.feed];
  const thresholdOk = form.resolution === "MUTUAL" || Number(form.thresholdUsd.replace(/[$,]/g, "")) > 0;
  const deadlineOk = form.deadline.getTime() > Date.now() + 60_000;
  const valid =
    (isPublic || !!opponent) &&
    form.title.trim().length >= 3 &&
    form.conditionText.trim().length >= 5 &&
    form.stake.myStake > 0n &&
    form.stake.theirStake > 0n &&
    thresholdOk &&
    deadlineOk;

  return (
    <div className="animate-pop space-y-5 rounded-3xl bg-card p-5">
      {form.clarifications.length > 0 && (
        <div className="flex gap-2 rounded-2xl bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <ul className="space-y-1">
            {form.clarifications.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      <Field label={form.resolution === "ORACLE" ? "Who can take it" : "Against"}>
        {form.resolution === "ORACLE" && (
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1">
            {([false, true] as const).map((pub) => (
              <button
                key={String(pub)}
                type="button"
                onClick={() => set("isPublic", pub)}
                className={cn(
                  "rounded-xl px-3 py-2 text-sm font-bold transition-all",
                  isPublic === pub ? "bg-background shadow-sm" : "text-muted-foreground",
                )}
              >
                {pub ? "🌍 Anyone" : "👯 A friend"}
              </button>
            ))}
          </div>
        )}
        {isPublic ? (
          <p className="text-xs text-muted-foreground">
            Posted to the Public tab. Anyone with an account can take the other side; the first taker locks it in.
          </p>
        ) : friends.length === 0 ? (
          <p className="text-sm text-muted-foreground">Add a friend first (Friends tab).</p>
        ) : (
          <Select value={form.opponentUsername || undefined} onValueChange={(v) => set("opponentUsername", v)}>
            <SelectTrigger className="h-12 w-full rounded-xl">
              <SelectValue placeholder="Pick a friend" />
            </SelectTrigger>
            <SelectContent>
              {friends.map((f) => (
                <SelectItem key={f.id} value={f.username!}>
                  <span className="flex items-center gap-2">
                    <UserAvatar seed={f.avatarSeed} name={f.displayName ?? f.username} size={22} />
                    {f.displayName ?? f.username} <span className="text-muted-foreground">@{f.username}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>

      <Field label="Title">
        <Input className="h-12 rounded-xl text-base font-bold" value={form.title} maxLength={80} onChange={(e) => set("title", e.target.value)} />
      </Field>

      <Field label="YES means… (be precise)">
        <Textarea
          className="min-h-20 rounded-xl"
          value={form.conditionText}
          maxLength={500}
          onChange={(e) => set("conditionText", e.target.value)}
        />
      </Field>

      <Field label="Who decides">
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1">
          {(["ORACLE", "MUTUAL"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => set("resolution", r)}
              className={cn(
                "rounded-xl px-3 py-2 text-sm font-bold transition-all",
                form.resolution === r ? "bg-background shadow-sm" : "text-muted-foreground",
              )}
            >
              {r === "ORACLE" ? "📈 Price oracle" : "🤝 We agree"}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {form.resolution === "ORACLE"
            ? "Settles automatically from the live price feed."
            : "Friends only. You both confirm the result; if you disagree, it's refunded after 48h."}
        </p>
      </Field>

      {form.resolution === "ORACLE" && (
        <div className="grid grid-cols-[5.5rem_1fr] gap-2">
          <Field label="Asset">
            <Select value={form.feed} onValueChange={(v) => set("feed", v as FeedStr)}>
              <SelectTrigger className="h-12 w-full rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(FEED_LABEL) as FeedStr[]).map((f) => (
                  <SelectItem key={f} value={f}>
                    {FEED_LABEL[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Condition">
            <Select value={form.kind} onValueChange={(v) => set("kind", v as ConditionStr)}>
              <SelectTrigger className="h-12 w-full rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(KIND_LABEL) as ConditionStr[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {KIND_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Price" className="col-span-2">
            <div className="relative">
              <span className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                inputMode="decimal"
                className="h-12 rounded-xl pl-7 text-lg font-bold"
                value={form.thresholdUsd}
                onChange={(e) => set("thresholdUsd", e.target.value)}
              />
            </div>
            {livePrice && (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => set("thresholdUsd", (Number(livePrice.price) / 1e6).toFixed(2))}
              >
                {FEED_LABEL[form.feed]} is {formatPrice(livePrice.price)} right now · use it
              </button>
            )}
          </Field>
        </div>
      )}

      <Field label="Deadline">
        <Input
          type="datetime-local"
          className="h-12 rounded-xl"
          value={toLocalInput(form.deadline)}
          onChange={(e) => {
            const d = new Date(e.target.value);
            if (!isNaN(d.getTime())) set("deadline", d);
          }}
        />
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
          {QUICK_DEADLINES.map((q) => (
            <button
              key={q.label}
              type="button"
              className="shrink-0 rounded-full bg-muted px-3 py-1 text-xs font-semibold"
              onClick={() => set("deadline", q.at())}
            >
              {q.label}
            </button>
          ))}
        </div>
        <p className={cn("text-xs", deadlineOk ? "text-muted-foreground" : "text-destructive")}>
          {deadlineOk ? formatDateTime(form.deadline) : "Pick a time at least a minute from now."}
        </p>
      </Field>

      <StakeEditor key={stakeKey} value={form.stake} onChange={(s) => set("stake", s)} themName={themName} />

      <Button size="lg" className="h-14 w-full text-base font-black" disabled={!valid || sending} onClick={onSend}>
        {sending ? <Loader2 className="animate-spin" /> : <Send />}
        {sending
          ? "Sending…"
          : isPublic
            ? "Post public bet"
            : `Send challenge${opponent ? ` to ${opponent.displayName ?? opponent.username}` : ""}`}
      </Button>
    </div>
  );
}
