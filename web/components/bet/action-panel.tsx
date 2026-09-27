"use client";

import { Check, Globe, Loader2, Lock, Repeat2, Trophy, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { OracleProgress } from "@/components/bet/oracle-progress";
import { PayoutLine, StakeEditor, type StakeValue } from "@/components/bet/stake-editor";
import { Countdown } from "@/components/countdown";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { useBetActions } from "@/hooks/use-bet-actions";
import type { BetDTO } from "@/lib/bet-types";
import { holderOf, opposite, type Perspective } from "@/lib/bet-view";
import { formatUsd } from "@/lib/money";
import { americanFromStakes } from "@/lib/odds";
import { explorerAddress } from "@/lib/solana/explorer";

type Actions = ReturnType<typeof useBetActions>;

function Panel({ title, children, tone = "default" }: { title?: ReactNode; children: ReactNode; tone?: "default" | "hot" }) {
  return (
    <div className={tone === "hot" ? "space-y-3 rounded-3xl bg-primary/10 p-4 ring-1 ring-primary/40" : "space-y-3 rounded-3xl bg-card p-4"}>
      {title && <p className="font-bold">{title}</p>}
      {children}
    </div>
  );
}

function Busy({ on }: { on: boolean }) {
  return on ? <Loader2 className="animate-spin" /> : null;
}

function CounterSheet({ bet, p, actions, open, onOpenChange }: { bet: BetDTO; p: Perspective; actions: Actions; open: boolean; onOpenChange: (o: boolean) => void }) {
  const initial: StakeValue = {
    side: p.mySide ?? "NO",
    myStake: p.myStake,
    theirStake: p.theirStake,
    mode: p.myStake === p.theirStake ? "even" : "custom",
    odds: null,
  };
  const [value, setValue] = useState<StakeValue>(initial);
  const themName = p.them?.displayName ?? p.them?.username ?? "They";
  const unchanged = value.side === initial.side && value.myStake === initial.myStake && value.theirStake === initial.theirStake;

  const submit = async () => {
    // Convert "my view" back into creator/opponent terms for the program.
    const next = p.isCreator
      ? { creatorSide: value.side, creatorStake: value.myStake, opponentStake: value.theirStake }
      : { creatorSide: opposite(value.side), creatorStake: value.theirStake, opponentStake: value.myStake };
    const sig = await actions.counter(bet, next);
    if (sig) onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-h-[92dvh] max-w-md overflow-y-auto rounded-t-3xl p-5">
        <SheetHeader className="p-0 pb-2">
          <SheetTitle>Counteroffer</SheetTitle>
          <SheetDescription>This becomes v{bet.version + 1}. {themName} has to accept that exact version.</SheetDescription>
        </SheetHeader>
        <StakeEditor value={value} onChange={setValue} themName={themName} />
        <Button
          size="lg"
          className="mt-4 h-13 w-full font-black"
          disabled={unchanged || value.myStake <= 0n || value.theirStake <= 0n || !!actions.pending}
          onClick={submit}
        >
          <Busy on={actions.pending === "counter"} />
          Send v{bet.version + 1}
        </Button>
      </SheetContent>
    </Sheet>
  );
}

export function ActionPanel({
  bet,
  p,
  actions,
  isGuest = false,
  onSignIn,
}: {
  bet: BetDTO;
  p: Perspective;
  actions: Actions;
  /** Guests see the buttons greyed out with a sign-in prompt. */
  isGuest?: boolean;
  onSignIn?: () => void;
}) {
  const [counterOpen, setCounterOpen] = useState(false);
  const busy = !!actions.pending;
  const them = p.them?.displayName ?? p.them?.username ?? "them";
  const pot = formatUsd(p.pot);

  // An open bet this viewer could take: they'd get the opposite side of the creator.
  if (p.canTake) {
    const stake = BigInt(bet.opponentStake);
    const creatorName = bet.creator.displayName ?? `@${bet.creator.username}`;
    return (
      <Panel tone="hot" title={<span className="flex items-center gap-2"><Globe className="size-4" /> Open bet: take the other side</span>}>
        <p className="text-sm">
          {creatorName} is on <b className={bet.creatorSide === "YES" ? "text-yes" : "text-no"}>{bet.creatorSide}</b>. You&apos;d take{" "}
          <b className={bet.creatorSide === "YES" ? "text-no" : "text-yes"}>{opposite(bet.creatorSide)}</b>.
        </p>
        <PayoutLine myStake={stake} theirStake={BigInt(bet.creatorStake)} />
        <Button
          size="lg"
          className="h-13 w-full font-black"
          disabled={isGuest || busy}
          onClick={() => actions.take(bet)}
        >
          {isGuest ? <Lock /> : <Busy on={actions.pending === "take"} />}
          Take it: put in {formatUsd(stake)}
        </Button>
        {isGuest ? (
          <p className="text-center text-sm text-muted-foreground">
            You&apos;re browsing as a guest.{" "}
            <button className="font-semibold text-foreground underline underline-offset-4" onClick={onSignIn}>
              Sign in
            </button>{" "}
            to take this bet.
          </p>
        ) : (
          <p className="text-center text-xs text-muted-foreground">
            First come, first served. Your money locks in escrow right away; {creatorName} then funds their side.
            {bet.acceptDeadline && (
              <>
                {" "}
                Open for <Countdown to={bet.acceptDeadline} />.
              </>
            )}
          </p>
        )}
      </Panel>
    );
  }

  if (!p.isParticipant) {
    return (
      <Panel>
        <p className="text-sm text-muted-foreground">You&apos;re watching this one from the sidelines.</p>
        {bet.state === "ACTIVE" && <OracleProgress bet={bet} live />}
      </Panel>
    );
  }

  if (p.action === "REFUND") {
    return (
      <Panel title="⌛ This one timed out">
        <p className="text-sm text-muted-foreground">
          {bet.state === "PROPOSED"
            ? "The offer expired before it was accepted."
            : bet.state === "ACCEPTED"
              ? "Not everyone funded in time. Anything that was put in goes back."
              : "Nobody settled it in time, so both sides get their money back."}{" "}
          The resolver cleans these up automatically, or you can do it now.
        </p>
        <Button className="h-12 w-full font-bold" disabled={busy} onClick={() => actions.refundExpired(bet)}>
          <Busy on={actions.pending === "refund"} /> Refund & close
        </Button>
      </Panel>
    );
  }

  switch (bet.state) {
    case "PROPOSED":
      if (p.action === "RESPOND") {
        const odds = americanFromStakes(p.myStake, p.theirStake);
        return (
          <Panel tone="hot" title={bet.version === 1 ? `${them} challenged you` : `${them} sent a counteroffer (v${bet.version})`}>
            <p className="text-sm">
              You&apos;d take <b className={p.mySide === "YES" ? "text-yes" : "text-no"}>{p.mySide}</b>
              {odds !== 100 && <span className="text-muted-foreground"> at {odds > 0 ? `+${odds}` : odds}</span>}.
            </p>
            <PayoutLine myStake={p.myStake} theirStake={p.theirStake} />
            <Button size="lg" className="h-13 w-full text-base font-black" disabled={busy} onClick={() => actions.accept(bet)}>
              <Busy on={actions.pending === "accept"} />
              {actions.pending !== "accept" && <Check />} Accept v{bet.version}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" className="h-11" disabled={busy} onClick={() => setCounterOpen(true)}>
                <Repeat2 /> Counter
              </Button>
              <Button variant="ghost" className="h-11 text-destructive" disabled={busy} onClick={() => actions.cancel(bet, "Declined")}>
                <Busy on={actions.pending === "cancel"} /> {actions.pending !== "cancel" && <X />} Decline
              </Button>
            </div>
            {bet.acceptDeadline && (
              <p className="text-center text-xs text-muted-foreground">
                Offer expires in <Countdown to={bet.acceptDeadline} doneText="a moment" />
              </p>
            )}
            <CounterSheet key={bet.version} bet={bet} p={p} actions={actions} open={counterOpen} onOpenChange={setCounterOpen} />
          </Panel>
        );
      }
      if (p.isOpen) {
        return (
          <Panel title="Waiting for someone to take it…">
            <p className="text-sm text-muted-foreground">
              It&apos;s on the Public board. Anyone signed in can take the other side.
              {bet.acceptDeadline && (
                <>
                  {" "}
                  Open for <Countdown to={bet.acceptDeadline} />.
                </>
              )}
            </p>
            <Button variant="ghost" className="w-full text-destructive" disabled={busy} onClick={() => actions.cancel(bet, "Open bet closed")}>
              <Busy on={actions.pending === "cancel"} /> Close it
            </Button>
          </Panel>
        );
      }
      return (
        <Panel title={`Waiting for ${them}…`}>
          <p className="text-sm text-muted-foreground">
            They can accept v{bet.version}, counter, or decline.
            {bet.acceptDeadline && (
              <>
                {" "}
                Expires in <Countdown to={bet.acceptDeadline} />.
              </>
            )}
          </p>
          <Button variant="ghost" className="w-full text-destructive" disabled={busy} onClick={() => actions.cancel(bet, "Offer withdrawn")}>
            <Busy on={actions.pending === "cancel"} /> Withdraw offer
          </Button>
        </Panel>
      );

    case "ACCEPTED":
      return (
        <Panel tone={p.myFunded ? "default" : "hot"} title={p.myFunded ? `Waiting for ${them} to fund…` : "Deal! Now put your money in"}>
          {!p.myFunded ? (
            <Button size="lg" className="h-14 w-full text-base font-black" disabled={busy} onClick={() => actions.fund(bet, p.myStake)}>
              <Busy on={actions.pending === "fund"} />
              {actions.pending !== "fund" && <Lock />} Fund {formatUsd(p.myStake)}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">Your {formatUsd(p.myStake)} is locked. The bet goes live when {them} funds.</p>
          )}
          {bet.fundingDeadline && (
            <p className="text-center text-xs text-muted-foreground">
              Funding closes in <Countdown to={bet.fundingDeadline} />
            </p>
          )}
        </Panel>
      );

    case "ACTIVE":
      return (
        <div className="space-y-3">
          <Panel>
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 font-bold">
                <Lock className="size-4 text-brand-ink" /> {pot} locked in escrow
              </p>
              <a className="text-xs text-muted-foreground underline" href={explorerAddress(bet.vaultPda)} target="_blank" rel="noreferrer">
                vault
              </a>
            </div>
            <p className="text-sm text-muted-foreground">
              {Date.parse(bet.eventDeadline) > Date.now() ? (
                <>
                  Decided in <Countdown to={bet.eventDeadline} className="font-bold text-foreground" />
                </>
              ) : bet.resolutionKind === "ORACLE" ? (
                "Deadline passed — the resolver is settling it now…"
              ) : (
                "Deadline passed — who won?"
              )}
            </p>
          </Panel>
          {bet.resolutionKind === "ORACLE" ? (
            <OracleProgress bet={bet} live />
          ) : (
            <Panel title="Who won?" tone={p.action === "REPORT_RESULT" ? "hot" : "default"}>
              <div className="grid grid-cols-2 gap-2">
                <Button className="h-12 font-bold" disabled={busy} onClick={() => actions.proposeOutcome(bet, p.mySide!)}>
                  <Busy on={actions.pending === "propose"} /> <Trophy /> I won
                </Button>
                <Button variant="secondary" className="h-12 font-bold" disabled={busy} onClick={() => actions.proposeOutcome(bet, opposite(p.mySide!))}>
                  {them} won
                </Button>
              </div>
              <Button variant="ghost" size="sm" className="w-full text-muted-foreground" disabled={busy} onClick={() => actions.proposeOutcome(bet, "VOID")}>
                Call it off (refund both)
              </Button>
              <p className="text-xs text-muted-foreground">{them} has to confirm. Money only moves when you both agree.</p>
            </Panel>
          )}
        </div>
      );

    case "AWAITING_CONFIRMATION": {
      const claim =
        bet.proposedWinner === "VOID"
          ? "call it off and refund both sides"
          : `${holderOf(bet, bet.proposedWinner!)?.id === p.me?.id ? "you" : them} won`;
      if (p.action === "CONFIRM_OUTCOME") {
        return (
          <Panel tone="hot" title={`${them} says ${claim}`}>
            <p className="text-sm text-muted-foreground">
              {bet.proposedWinner === "VOID" ? "Confirming refunds both of you." : `Confirming pays the ${pot} pot out immediately.`}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button className="h-12 font-bold" disabled={busy} onClick={() => actions.confirmOutcome(bet)}>
                <Busy on={actions.pending === "confirm"} /> <Check /> Confirm
              </Button>
              <Button variant="secondary" className="h-12 font-bold" disabled={busy} onClick={() => actions.rejectOutcome(bet)}>
                <Busy on={actions.pending === "reject"} /> Dispute
              </Button>
            </div>
          </Panel>
        );
      }
      return (
        <Panel title={`Waiting for ${them} to confirm…`}>
          <p className="text-sm text-muted-foreground">You said {claim.replace(/^you/, "you")}. If they dispute, it goes back to live.</p>
        </Panel>
      );
    }
    default:
      return null;
  }
}
