"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, PencilLine, Sparkles, Zap } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ReviewCard } from "@/components/bet/review-card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useGoSignIn } from "@/components/app-shell";
import { useBetActions } from "@/hooks/use-bet-actions";
import { useViewer } from "@/hooks/use-session";
import { usePrices } from "@/hooks/use-prices";
import { api, ApiClientError } from "@/lib/api-client";
import type { UserDTO } from "@/lib/bet-types";
import { draftFromParsed, emptyDraft, toDraftInput, type DraftForm, type ParsedBet } from "@/lib/draft";

const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
const DEMO_MINUTES = Number(process.env.NEXT_PUBLIC_DEMO_MINUTES || 3);

function NewBet() {
  const router = useRouter();
  const presetOpponent = useSearchParams().get("opponent") ?? "";
  const { create } = useBetActions();
  const { isGuest } = useViewer();
  const goSignIn = useGoSignIn();
  const { data: prices, refetch: refetchPrices } = usePrices();
  const friends = useQuery({
    queryKey: ["friends", "users"],
    enabled: !isGuest,
    queryFn: () => api<{ friends: { user: UserDTO }[] }>("/api/friends").then((r) => r.friends.map((f) => f.user)),
  });

  const [text, setText] = useState(presetOpponent ? `I bet @${presetOpponent} $10 that ` : "");
  const [form, setForm] = useState<DraftForm | null>(null);
  const [stakeKey, setStakeKey] = useState(0);
  const [parsing, setParsing] = useState(false);
  const [sending, setSending] = useState(false);

  const friendList = useMemo(() => friends.data ?? [], [friends.data]);
  const firstFriend = presetOpponent || friendList[0]?.username || "alex";
  const solNow = prices?.SOL_USD ? Math.round(Number(prices.SOL_USD.price) / 1e6) : null;

  const examples = [
    `I bet @${firstFriend} $10 SOL hits $${solNow ? solNow + 10 : 250} before midnight`,
    `$20 says @${firstFriend} can't run a 5K under 25 minutes this week`,
    `I'll give @${firstFriend} +150 odds on $10 that ETH is below $${prices?.ETH_USD ? Math.round(Number(prices.ETH_USD.price) / 1e6 / 10) * 10 : 3000} tomorrow night`,
  ];

  const openReview = (f: DraftForm, list: UserDTO[] = friendList) => {
    const known = list.some((u) => u.username === f.opponentUsername);
    setForm(known ? f : { ...f, opponentUsername: list[0]?.username ?? "" });
    setStakeKey((k) => k + 1);
  };

  const parse = async () => {
    if (!text.trim()) return;
    setParsing(true);
    try {
      const { parsed } = await api<{ parsed: ParsedBet }>("/api/parse-bet", {
        body: { text, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, now: new Date().toISOString() },
      });
      openReview(draftFromParsed(parsed, presetOpponent));
    } catch (e) {
      const msg = e instanceof ApiClientError && e.code === "AI_UNAVAILABLE" ? "AI parsing is off — fill it in below." : "Couldn't read that one — fill it in below.";
      toast.message(msg);
      openReview({ ...emptyDraft(presetOpponent || friendList[0]?.username || ""), title: text.slice(0, 80), conditionText: text });
    } finally {
      setParsing(false);
    }
  };

  // If friends load after the review opened, default the opponent to a real friend.
  useEffect(() => {
    if (form && friendList.length && !friendList.some((u) => u.username === form.opponentUsername)) {
      setForm({ ...form, opponentUsername: friendList[0].username ?? "" });
    }
  }, [form, friendList]);

  const demoPrefill = async () => {
    const list = friendList.length || isGuest ? friendList : ((await friends.refetch()).data ?? []);
    const opp = presetOpponent || list[0]?.username || "";
    let sol = solNow;
    if (!sol) {
      const fresh = (await refetchPrices()).data?.SOL_USD;
      sol = fresh ? Math.round(Number(fresh.price) / 1e6) : null;
    }
    if (!sol) {
      toast.error("Couldn't get the live SOL price — try again in a moment.");
      return;
    }
    const solNowVal = sol;
    setText(`I bet @${opp} $10 SOL is above $${solNowVal} in ${DEMO_MINUTES} minutes`);
    // Skip the AI round-trip for reliability: fill the exact demo terms directly.
    const base = emptyDraft(opp);
    openReview({
      ...base,
      title: `SOL above $${solNowVal} in ${DEMO_MINUTES} min`,
      conditionText: `YES if the SOL/USD price is at or above $${solNowVal}.00 at the deadline (${DEMO_MINUTES} minutes from now).`,
      resolution: "ORACLE",
      feed: "SOL_USD",
      kind: "ABOVE_AT",
      thresholdUsd: String(solNowVal),
      deadline: new Date(Date.now() + DEMO_MINUTES * 60_000),
    }, list);
  };

  const send = async () => {
    if (!form) return;
    setSending(true);
    try {
      const id = await create(toDraftInput(form));
      if (id) router.push(`/bet/${id}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={form ? "Review the bet" : "New bet"}
        subtitle={form ? "Tweak anything before it goes out." : "Say it like you'd text it."}
        right={
          form ? (
            <Button variant="ghost" size="sm" onClick={() => setForm(null)}>
              <ArrowLeft /> Edit text
            </Button>
          ) : DEMO ? (
            <Button variant="secondary" size="sm" onClick={demoPrefill}>
              <Zap /> Demo
            </Button>
          ) : null
        }
      />

      {!form ? (
        <div className="space-y-4">
          <Textarea
            autoFocus
            placeholder={`I bet @${firstFriend} $10 SOL hits $250 before midnight`}
            className="min-h-36 rounded-3xl bg-card p-5 text-lg leading-snug font-semibold"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void parse();
            }}
          />
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
            {examples.map((ex) => (
              <button
                key={ex}
                className="shrink-0 rounded-full border border-border px-3 py-1.5 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
                onClick={() => setText(ex)}
              >
                {ex}
              </button>
            ))}
          </div>
          <Button size="lg" className="h-14 w-full text-base font-black" onClick={parse} disabled={parsing || !text.trim()}>
            {parsing ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {parsing ? "Reading your bet…" : "Make it a bet"}
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => openReview(emptyDraft(presetOpponent || friendList[0]?.username || ""))}
          >
            <PencilLine /> Fill it in myself
          </Button>
        </div>
      ) : (
        <ReviewCard
          form={form}
          setForm={setForm}
          friends={friendList}
          prices={prices}
          sending={sending}
          onSend={send}
          stakeKey={stakeKey}
          isGuest={isGuest}
          onSignIn={goSignIn}
        />
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <NewBet />
    </Suspense>
  );
}
