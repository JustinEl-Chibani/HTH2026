// Client-side interpretation of a bet from the viewer's point of view.
import type { BetDTO, UserDTO } from "./bet-types";
import type { SideStr } from "./solana/codec";
import { formatPrice } from "./money";

export const opposite = (s: SideStr): SideStr => (s === "YES" ? "NO" : "YES");

export type NextAction =
  | "RESPOND" // accept / counter / decline the current offer
  | "FUND"
  | "CONFIRM_OUTCOME"
  | "REPORT_RESULT" // mutual bet past its deadline
  | "REFUND" // something expired and can be cranked
  | null;

export interface Perspective {
  isParticipant: boolean;
  isCreator: boolean;
  me: UserDTO | null;
  them: UserDTO | null;
  mySide: SideStr | null;
  myStake: bigint;
  theirStake: bigint;
  pot: bigint;
  myFunded: boolean;
  theirFunded: boolean;
  /** What the viewer should do next, if anything. */
  action: NextAction;
  /** Waiting on the other side (for "waiting on Alex…" copy). */
  waitingOnThem: boolean;
  /** For settled bets. */
  iWon: boolean | null;
}

export function perspective(bet: BetDTO, meId: string | undefined, now = Date.now()): Perspective {
  const isCreator = bet.creator.id === meId;
  const isOpponent = !!bet.opponent && bet.opponent.id === meId;
  const isParticipant = isCreator || isOpponent;
  const cStake = BigInt(bet.creatorStake);
  const oStake = BigInt(bet.opponentStake);
  const mySide = isCreator ? bet.creatorSide : isOpponent ? opposite(bet.creatorSide) : null;
  const myFunded = isCreator ? bet.creatorFunded : bet.opponentFunded;
  const theirFunded = isCreator ? bet.opponentFunded : bet.creatorFunded;

  let action: NextAction = null;
  let waitingOnThem = false;
  if (isParticipant) {
    const expired = (d: string | null) => !!d && Date.parse(d) <= now;
    switch (bet.state) {
      case "PROPOSED":
        if (expired(bet.acceptDeadline)) action = "REFUND";
        else if (bet.lastProposerId !== meId) action = "RESPOND";
        else waitingOnThem = true;
        break;
      case "ACCEPTED":
        if (expired(bet.fundingDeadline)) action = "REFUND";
        else if (!myFunded) action = "FUND";
        else waitingOnThem = true;
        break;
      case "ACTIVE":
        if (expired(bet.resolveDeadline)) action = "REFUND";
        else if (bet.resolutionKind === "MUTUAL" && expired(bet.eventDeadline)) action = "REPORT_RESULT";
        break;
      case "AWAITING_CONFIRMATION":
        if (bet.proposedById !== meId) action = "CONFIRM_OUTCOME";
        else waitingOnThem = true;
        break;
    }
  }

  return {
    isParticipant,
    isCreator,
    me: isCreator ? bet.creator : isOpponent ? bet.opponent : null,
    them: isCreator ? bet.opponent : isOpponent ? bet.creator : null,
    mySide,
    myStake: isCreator ? cStake : oStake,
    theirStake: isCreator ? oStake : cStake,
    pot: cStake + oStake,
    myFunded,
    theirFunded,
    action,
    waitingOnThem,
    iWon: bet.state === "SETTLED" && bet.winnerSide && mySide ? bet.winnerSide === mySide : null,
  };
}

export function holderOf(bet: BetDTO, side: SideStr): UserDTO | null {
  return side === bet.creatorSide ? bet.creator : bet.opponent;
}

export const FEED_LABEL = { SOL_USD: "SOL", BTC_USD: "BTC", ETH_USD: "ETH" } as const;

export function describeOracle(o: NonNullable<BetDTO["oracle"]>): string {
  const asset = FEED_LABEL[o.feed];
  const price = formatPrice(o.threshold);
  switch (o.kind) {
    case "TOUCH_ABOVE":
      return `${asset} hits ${price} before the deadline`;
    case "TOUCH_BELOW":
      return `${asset} drops to ${price} before the deadline`;
    case "ABOVE_AT":
      return `${asset} is at or above ${price} at the deadline`;
    case "BELOW_AT":
      return `${asset} is at or below ${price} at the deadline`;
  }
}

export const STATE_LABEL: Record<BetDTO["state"], string> = {
  DRAFT: "Draft",
  PROPOSED: "Proposed",
  ACCEPTED: "Funding",
  ACTIVE: "Live",
  AWAITING_CONFIRMATION: "Confirming",
  SETTLED: "Settled",
  CANCELLED: "Called off",
  EXPIRED: "Expired",
  VOID: "Refunded",
};
