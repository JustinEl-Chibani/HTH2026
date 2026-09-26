// Instruction builders shared by the browser, the resolver worker and scripts. Relative imports only.
import { BN, type Program } from "@anchor-lang/core";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { SystemProgram, type PublicKey, type TransactionInstruction } from "@solana/web3.js";
import { enc, hexToBytes, type OracleTerms, type OutcomeStr, type ResolutionStr, type SideStr } from "./codec";
import { configPda, vaultPda, type PutYourMoney } from "./program";

type P = Program<PutYourMoney>;
const bn = (v: bigint | number) => new BN(v.toString());

export function createBetIx(
  program: P,
  a: {
    creator: PublicKey;
    bet: PublicKey;
    mint: PublicKey;
    betId: bigint;
    opponent: PublicKey;
    creatorSide: SideStr;
    creatorStake: bigint;
    opponentStake: bigint;
    termsHash: string;
    resolution: ResolutionStr;
    oracle: OracleTerms | null;
    acceptDeadline: number;
    eventDeadline: number;
  },
): Promise<TransactionInstruction> {
  return program.methods
    .createBet(
      bn(a.betId),
      a.opponent,
      enc.side(a.creatorSide),
      bn(a.creatorStake),
      bn(a.opponentStake),
      hexToBytes(a.termsHash),
      enc.resolution(a.resolution),
      enc.oracle(a.oracle, bn),
      bn(a.acceptDeadline),
      bn(a.eventDeadline),
    )
    .accountsPartial({
      creator: a.creator,
      config: configPda(),
      usdcMint: a.mint,
      bet: a.bet,
      vault: vaultPda(a.bet),
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export function counterOfferIx(
  program: P,
  a: {
    signer: PublicKey;
    bet: PublicKey;
    expectedVersion: number;
    creatorStake: bigint;
    opponentStake: bigint;
    creatorSide: SideStr;
    termsHash: string;
    eventDeadline: number;
    oracle: OracleTerms | null;
  },
) {
  return program.methods
    .counterOffer(
      a.expectedVersion,
      bn(a.creatorStake),
      bn(a.opponentStake),
      enc.side(a.creatorSide),
      hexToBytes(a.termsHash),
      bn(a.eventDeadline),
      enc.oracle(a.oracle, bn),
    )
    .accountsPartial({ signer: a.signer, bet: a.bet })
    .instruction();
}

export function acceptIx(program: P, a: { signer: PublicKey; bet: PublicKey; expectedVersion: number }) {
  return program.methods.accept(a.expectedVersion).accountsPartial({ signer: a.signer, bet: a.bet }).instruction();
}

export function fundIx(program: P, a: { funder: PublicKey; bet: PublicKey; mint: PublicKey }) {
  return program.methods
    .fund()
    .accountsPartial({
      funder: a.funder,
      config: configPda(),
      usdcMint: a.mint,
      bet: a.bet,
      vault: vaultPda(a.bet),
      funderToken: getAssociatedTokenAddressSync(a.mint, a.funder),
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
}

export function cancelIx(program: P, a: { signer: PublicKey; bet: PublicKey; creator: PublicKey }) {
  return program.methods
    .cancel()
    .accountsPartial({
      signer: a.signer,
      bet: a.bet,
      vault: vaultPda(a.bet),
      creator: a.creator,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
}

export function proposeOutcomeIx(program: P, a: { signer: PublicKey; bet: PublicKey; outcome: OutcomeStr }) {
  return program.methods
    .proposeOutcome(enc.outcome(a.outcome))
    .accountsPartial({ signer: a.signer, bet: a.bet })
    .instruction();
}

export function rejectOutcomeIx(program: P, a: { signer: PublicKey; bet: PublicKey }) {
  return program.methods.rejectOutcome().accountsPartial({ signer: a.signer, bet: a.bet }).instruction();
}

interface SettleAccounts {
  bet: PublicKey;
  creator: PublicKey;
  opponent: PublicKey;
  mint: PublicKey;
}

function settleAccounts(a: SettleAccounts) {
  return {
    config: configPda(),
    usdcMint: a.mint,
    bet: a.bet,
    vault: vaultPda(a.bet),
    creator: a.creator,
    opponent: a.opponent,
    creatorToken: getAssociatedTokenAddressSync(a.mint, a.creator),
    opponentToken: getAssociatedTokenAddressSync(a.mint, a.opponent),
    tokenProgram: TOKEN_PROGRAM_ID,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  };
}

export function confirmOutcomeIx(program: P, a: SettleAccounts & { signer: PublicKey }) {
  return program.methods
    .confirmOutcome()
    .accountsPartial({ signer: a.signer, ...settleAccounts(a) })
    .instruction();
}

export function resolveOracleIx(
  program: P,
  a: SettleAccounts & { resolver: PublicKey; winner: SideStr; resolvedValue: bigint },
) {
  return program.methods
    .resolveOracle(enc.side(a.winner), bn(a.resolvedValue))
    .accountsPartial({ resolver: a.resolver, ...settleAccounts(a) })
    .instruction();
}

export function refundExpiredIx(program: P, a: SettleAccounts & { payer: PublicKey }) {
  return program.methods
    .refundExpired()
    .accountsPartial({ payer: a.payer, ...settleAccounts(a) })
    .instruction();
}

/** Open bets: become the opponent and accept the exact version you saw. Pair with `fundIx` in the same tx. */
export function takePublicIx(program: P, a: { taker: PublicKey; bet: PublicKey; expectedVersion: number }) {
  return program.methods
    .takePublic(a.expectedVersion)
    .accountsPartial({ taker: a.taker, bet: a.bet })
    .instruction();
}

/** Expire a proposal nobody accepted in time (no token accounts needed, unlike refund_expired). */
export function expireProposalIx(program: P, a: { bet: PublicKey; creator: PublicKey }) {
  return program.methods
    .expireProposal()
    .accountsPartial({ bet: a.bet, vault: vaultPda(a.bet), creator: a.creator, tokenProgram: TOKEN_PROGRAM_ID })
    .instruction();
}
