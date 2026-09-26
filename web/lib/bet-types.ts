// Shape of bets as returned by the API (BigInts serialized as strings).
import type { BetStateStr, ConditionStr, FeedStr, OutcomeStr, ResolutionStr, SideStr } from "./solana/codec";

export interface UserDTO {
  id: string;
  wallet: string;
  username: string | null;
  displayName: string | null;
  avatarSeed: string;
  walletKind: "BURNER" | "WALLET" | null;
}

export interface BetVersionDTO {
  version: number;
  proposerId: string;
  creatorStake: string;
  opponentStake: string;
  creatorSide: SideStr;
  txSig: string | null;
  createdAt: string;
}

export interface BetEventDTO {
  id: string;
  type: string;
  actorId: string | null;
  txSig: string | null;
  data: Record<string, unknown> | null;
  createdAt: string;
}

export interface BetDTO {
  id: string;
  onchainBetId: string;
  betPda: string;
  vaultPda: string;
  title: string;
  conditionText: string;
  termsJson: string;
  resolutionKind: ResolutionStr;
  oracle: { feed: FeedStr; kind: ConditionStr; threshold: string } | null;
  creatorSide: SideStr;
  creatorStake: string;
  opponentStake: string;
  oddsAmerican: number | null;
  version: number;
  state: BetStateStr;
  creatorFunded: boolean;
  opponentFunded: boolean;
  acceptDeadline: string | null;
  fundingDeadline: string | null;
  eventDeadline: string;
  resolveDeadline: string | null;
  proposedWinner: OutcomeStr | null;
  proposedById: string | null;
  winnerSide: SideStr | null;
  resolvedValue: string | null;
  lastProposerId: string | null;
  createdAt: string;
  updatedAt: string;
  creator: UserDTO;
  opponent: UserDTO | null;
  versions?: BetVersionDTO[];
  events?: BetEventDTO[];
  /** Open to anyone (price-oracle bets only); `opponent` is null until someone takes it. */
  isPublic: boolean;
  /** Signature of the tx that ended the bet (payout / refund), for "View on Solana". */
  finalTxSig?: string | null;
}
