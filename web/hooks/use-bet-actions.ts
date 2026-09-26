"use client";

import { AnchorProvider } from "@anchor-lang/core";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { useAnchorWallet, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, VersionedTransaction, type TransactionInstruction } from "@solana/web3.js";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import type { DraftInput } from "@/lib/bet-schema";
import type { BetDTO } from "@/lib/bet-types";
import { friendlyError } from "@/lib/errors";
import { formatUsd } from "@/lib/money";
import type { OracleTerms, OutcomeStr, SideStr } from "@/lib/solana/codec";
import { explorerTx } from "@/lib/solana/explorer";
import * as ix from "@/lib/solana/instructions";
import { getProgram, getReadonlyProgram } from "@/lib/solana/program";
import { termsJsonAndHash, type Terms } from "@/lib/terms";

const MINT = new PublicKey(process.env.NEXT_PUBLIC_USDC_MINT || PublicKey.default.toBase58());

const oracleOf = (b: BetDTO): OracleTerms | null =>
  b.oracle ? { ...b.oracle, threshold: BigInt(b.oracle.threshold) } : null;
const pk = (s: string) => new PublicKey(s);

const settleAccts = (bet: BetDTO) => ({
  bet: pk(bet.betPda),
  creator: pk(bet.creator.wallet),
  opponent: pk(bet.opponent!.wallet),
  mint: MINT,
});

class TxError extends Error {
  constructor(
    message: string,
    public logs: string[],
  ) {
    super(message);
  }
}

export function useBetActions() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const anchorWallet = useAnchorWallet();
  const qc = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);

  const program = useMemo(
    () =>
      anchorWallet
        ? getProgram(new AnchorProvider(connection, anchorWallet, { commitment: "confirmed" }))
        : getReadonlyProgram(connection),
    [connection, anchorWallet],
  );

  /** Build → simulate → wallet sign/send → confirm → server sync. Returns the tx signature. */
  const run = useCallback(
    async (
      key: string,
      label: string,
      build: () => Promise<TransactionInstruction[]>,
      sync: (sig: string) => Promise<BetDTO | void>,
    ): Promise<string | null> => {
      if (!publicKey) {
        toast.error("Connect your wallet first");
        return null;
      }
      setPending(key);
      const toastId = toast.loading(`${label}…`, { description: "Approve it in your wallet" });
      try {
        const tx = new Transaction().add(...(await build()));
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
        tx.feePayer = publicKey;
        tx.recentBlockhash = blockhash;

        // Simulate first so program errors come back with logs we can turn into friendly copy.
        const sim = await connection.simulateTransaction(new VersionedTransaction(tx.compileMessage()), {
          sigVerify: false,
          replaceRecentBlockhash: true,
        });
        if (sim.value.err) throw new TxError(JSON.stringify(sim.value.err), sim.value.logs ?? []);

        const sig = await sendTransaction(tx, connection, { skipPreflight: true });
        toast.loading("Confirming on Solana…", { id: toastId, description: "Usually a couple of seconds" });
        const conf = await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
        if (conf.value.err) throw new TxError(JSON.stringify(conf.value.err), []);

        let bet: BetDTO | void = undefined;
        try {
          bet = await sync(sig);
        } catch {
          // The tx landed; the page's polling /refresh will catch the DB up.
        }
        if (bet) qc.setQueryData(["bet", bet.id], bet);
        void qc.invalidateQueries({ queryKey: ["bets"] });
        void qc.invalidateQueries({ queryKey: ["balances"] });
        void qc.invalidateQueries({ queryKey: ["notifications"] });
        toast.success(label, {
          id: toastId,
          description: undefined,
          action: { label: "View on Solana", onClick: () => window.open(explorerTx(sig), "_blank") },
        });
        return sig;
      } catch (e) {
        toast.error(friendlyError(e), { id: toastId, description: undefined });
        return null;
      } finally {
        setPending(null);
      }
    },
    [publicKey, connection, sendTransaction, qc],
  );

  const syncBet = useCallback(
    (id: string, body: { txSig: string; termsJson?: string }) =>
      api<{ bet: BetDTO }>(`/api/bets/${id}/sync`, { body }).then((r) => r.bet),
    [],
  );

  const create = useCallback(
    async (draft: DraftInput): Promise<string | null> => {
      let created: { bet: BetDTO; chain: { betId: string; betPda: string; termsHash: string; acceptDeadline: number; eventDeadline: number; opponentWallet: string } };
      try {
        created = await api("/api/bets", { body: draft });
      } catch (e) {
        toast.error(friendlyError(e));
        return null;
      }
      const { bet, chain } = created;
      const sig = await run(
        "create",
        "Challenge sent",
        async () => [
          await ix.createBetIx(program, {
            creator: publicKey!,
            bet: pk(chain.betPda),
            mint: MINT,
            betId: BigInt(chain.betId),
            opponent: pk(chain.opponentWallet),
            creatorSide: draft.creatorSide,
            creatorStake: BigInt(draft.creatorStake),
            opponentStake: BigInt(draft.opponentStake),
            termsHash: chain.termsHash,
            resolution: draft.resolution,
            oracle: draft.oracle ? { ...draft.oracle, threshold: BigInt(draft.oracle.threshold) } : null,
            acceptDeadline: chain.acceptDeadline,
            eventDeadline: chain.eventDeadline,
          }),
        ],
        (txSig) => syncBet(bet.id, { txSig }),
      );
      return sig ? bet.id : null;
    },
    [program, publicKey, run, syncBet],
  );

  const counter = useCallback(
    (bet: BetDTO, next: { creatorSide: SideStr; creatorStake: bigint; opponentStake: bigint }) => {
      const prev = JSON.parse(bet.termsJson) as Terms;
      const { termsJson, termsHash } = termsJsonAndHash({
        ...prev,
        creatorSide: next.creatorSide,
        creatorStake: next.creatorStake.toString(),
        opponentStake: next.opponentStake.toString(),
      });
      return run(
        "counter",
        `Counteroffer v${bet.version + 1} sent`,
        async () => [
          await ix.counterOfferIx(program, {
            signer: publicKey!,
            bet: pk(bet.betPda),
            expectedVersion: bet.version,
            creatorStake: next.creatorStake,
            opponentStake: next.opponentStake,
            creatorSide: next.creatorSide,
            termsHash,
            eventDeadline: Math.floor(Date.parse(bet.eventDeadline) / 1000),
            oracle: oracleOf(bet),
          }),
        ],
        (txSig) => syncBet(bet.id, { txSig, termsJson }),
      );
    },
    [program, publicKey, run, syncBet],
  );

  const accept = useCallback(
    (bet: BetDTO) =>
      run(
        "accept",
        "Bet accepted — now fund it",
        async () => [await ix.acceptIx(program, { signer: publicKey!, bet: pk(bet.betPda), expectedVersion: bet.version })],
        (txSig) => syncBet(bet.id, { txSig }),
      ),
    [program, publicKey, run, syncBet],
  );

  const fund = useCallback(
    async (bet: BetDTO, amount: bigint) => {
      if (publicKey) {
        try {
          const bal = await connection.getTokenAccountBalance(getAssociatedTokenAddressSync(MINT, publicKey));
          if (BigInt(bal.value.amount) < amount) {
            toast.error(`You need ${formatUsd(amount)} but have ${formatUsd(BigInt(bal.value.amount))}. Grab test USDC on your Profile.`);
            return null;
          }
        } catch {
          toast.error("You don't have any test USDC yet — grab some on your Profile.");
          return null;
        }
      }
      return run(
        "fund",
        `${formatUsd(amount)} locked in escrow`,
        async () => [await ix.fundIx(program, { funder: publicKey!, bet: pk(bet.betPda), mint: MINT })],
        (txSig) => syncBet(bet.id, { txSig }),
      );
    },
    [program, publicKey, connection, run, syncBet],
  );

  const cancel = useCallback(
    (bet: BetDTO, label = "Bet called off") =>
      run(
        "cancel",
        label,
        async () => [await ix.cancelIx(program, { signer: publicKey!, bet: pk(bet.betPda), creator: pk(bet.creator.wallet) })],
        (txSig) => syncBet(bet.id, { txSig }),
      ),
    [program, publicKey, run, syncBet],
  );

  const proposeOutcome = useCallback(
    (bet: BetDTO, outcome: OutcomeStr) =>
      run(
        "propose",
        outcome === "VOID" ? "Asked to call it off" : "Result submitted",
        async () => [await ix.proposeOutcomeIx(program, { signer: publicKey!, bet: pk(bet.betPda), outcome })],
        (txSig) => syncBet(bet.id, { txSig }),
      ),
    [program, publicKey, run, syncBet],
  );

  const confirmOutcome = useCallback(
    (bet: BetDTO) =>
      run(
        "confirm",
        bet.proposedWinner === "VOID" ? "Bet voided — refunds sent" : "Confirmed — pot paid out",
        async () => [await ix.confirmOutcomeIx(program, { signer: publicKey!, ...settleAccts(bet) })],
        (txSig) => syncBet(bet.id, { txSig }),
      ),
    [program, publicKey, run, syncBet],
  );

  const rejectOutcome = useCallback(
    (bet: BetDTO) =>
      run(
        "reject",
        "Result disputed",
        async () => [await ix.rejectOutcomeIx(program, { signer: publicKey!, bet: pk(bet.betPda) })],
        (txSig) => syncBet(bet.id, { txSig }),
      ),
    [program, publicKey, run, syncBet],
  );

  const refundExpired = useCallback(
    (bet: BetDTO) =>
      run(
        "refund",
        "Refunded",
        async () => [await ix.refundExpiredIx(program, { payer: publicKey!, ...settleAccts(bet) })],
        (txSig) => syncBet(bet.id, { txSig }),
      ),
    [program, publicKey, run, syncBet],
  );

  return { pending, create, counter, accept, fund, cancel, proposeOutcome, confirmOutcome, rejectOutcome, refundExpired };
}
