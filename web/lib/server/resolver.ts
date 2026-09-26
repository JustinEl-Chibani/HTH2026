// Oracle resolver + expiry cranker. Trusted authority for the MVP (see README). Used by
// scripts/resolver.ts (loop) and /api/cron/resolve. Relative imports only.
import {
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
  Transaction,
  sendAndConfirmTransaction,
  type TransactionInstruction,
} from "@solana/web3.js";
import type { Bet, User } from "@prisma/client";
import { prisma } from "../db";
import { formatPrice } from "../money";
import { getPrices, type PriceMap } from "../prices";
import { isTouch, oracleIsYes, type ChainBet, type OracleTerms, type SideStr } from "../solana/codec";
import { refundExpiredIx, resolveOracleIx } from "../solana/instructions";
import { getReadonlyProgram } from "../solana/program";
import { connection, resolverKeypair, usdcMint } from "./solana";
import { fetchChainBet, syncBet } from "./sync";

type Log = (msg: string) => void;
type BetWithUsers = Bet & { creator: User; opponent: User | null };

export interface TickSummary {
  checked: number;
  resolved: { betId: string; winner: SideStr; price: string; txSig: string }[];
  refunded: { betId: string; txSig: string }[];
  errors: { betId: string; error: string }[];
}

const OPEN_STATES = ["PROPOSED", "ACCEPTED", "ACTIVE", "AWAITING_CONFIRMATION"];

async function send(ixs: TransactionInstruction[]): Promise<string> {
  return sendAndConfirmTransaction(connection(), new Transaction().add(...ixs), [resolverKeypair()], {
    commitment: "confirmed",
  });
}

function settleAccounts(bet: BetWithUsers) {
  return {
    bet: new PublicKey(bet.betPda),
    creator: new PublicKey(bet.creator.wallet),
    opponent: new PublicKey(bet.opponent!.wallet),
    mint: usdcMint(),
  };
}

/** Decide an oracle bet given the chain state and a price. Returns null if it's not decidable yet. */
export function decide(chain: ChainBet, oracle: OracleTerms, price: bigint, nowSecs: number): SideStr | null {
  const yes = oracleIsYes(oracle, price);
  const past = nowSecs >= chain.eventDeadline;
  if (isTouch(oracle.kind)) {
    if (yes) return "YES"; // touched — early YES allowed
    return past ? "NO" : null;
  }
  return past ? (yes ? "YES" : "NO") : null;
}

function expiredNow(chain: ChainBet, nowSecs: number): boolean {
  switch (chain.state) {
    case "PROPOSED":
      return nowSecs >= chain.acceptDeadline;
    case "ACCEPTED":
      return nowSecs >= chain.fundingDeadline;
    case "ACTIVE":
    case "AWAITING_CONFIRMATION":
      return nowSecs >= chain.resolveDeadline;
    default:
      return false;
  }
}

/**
 * On-chain unix time from the Clock sysvar (layout: slot u64, epoch_start_timestamp i64, epoch u64,
 * leader_schedule_epoch u64, unix_timestamp i64). More reliable than getBlockTime, which devnet
 * RPCs often can't answer for the newest slot. Falls back to wall clock.
 */
async function chainUnixTime(): Promise<number> {
  try {
    const info = await connection().getAccountInfo(SYSVAR_CLOCK_PUBKEY, "confirmed");
    if (info && info.data.length >= 40) return Number(info.data.readBigInt64LE(32));
  } catch {
    /* fall through */
  }
  return Math.floor(Date.now() / 1000);
}

/** One pass: resolve decidable oracle bets, refund anything past its deadlines. */
export async function runResolverTick(log: Log = console.log): Promise<TickSummary> {
  const summary: TickSummary = { checked: 0, resolved: [], refunded: [], errors: [] };
  const bets = await prisma.bet.findMany({
    where: { state: { in: OPEN_STATES }, opponentId: { not: null } },
    include: { creator: true, opponent: true },
  });
  if (!bets.length) return summary;

  const program = getReadonlyProgram(connection());
  // The program checks deadlines against its own clock, which can differ a little from wall clock.
  const chainNow = await chainUnixTime();

  let prices: PriceMap | null = null;
  const needPrices = bets.some((b) => b.resolutionKind === "ORACLE" && b.state === "ACTIVE");
  if (needPrices) {
    try {
      prices = await getPrices(4_000);
    } catch (e) {
      log(`⚠ price feeds unavailable: ${e instanceof Error ? e.message : e}`);
    }
  }

  for (const bet of bets) {
    summary.checked++;
    try {
      const chain = await fetchChainBet(bet.betPda);
      if (!chain) continue;
      if (chain.state !== bet.state) await syncBet(bet.id); // catch the DB up first

      if (expiredNow(chain, chainNow)) {
        const sig = await send([
          await refundExpiredIx(program, { payer: resolverKeypair().publicKey, ...settleAccounts(bet) }),
        ]);
        await syncBet(bet.id, { txSig: sig, eventData: { crankedBy: "resolver" } });
        summary.refunded.push({ betId: bet.id, txSig: sig });
        log(`↩ refunded/expired "${bet.title}" (${chain.state}) tx=${sig}`);
        continue;
      }

      if (chain.state !== "ACTIVE" || chain.resolution !== "ORACLE" || !chain.oracle || !prices) continue;
      const point = prices[chain.oracle.feed];
      const winner = decide(chain, chain.oracle, point.price, chainNow);
      if (!winner) continue;

      const sig = await send([
        await resolveOracleIx(program, {
          resolver: resolverKeypair().publicKey,
          ...settleAccounts(bet),
          winner,
          resolvedValue: point.price,
        }),
      ]);
      await syncBet(bet.id, {
        txSig: sig,
        eventData: {
          source: point.source,
          price: point.price.toString(),
          publishTime: point.publishTime,
          feed: chain.oracle.feed,
        },
      });
      summary.resolved.push({ betId: bet.id, winner, price: point.price.toString(), txSig: sig });
      log(`✅ resolved "${bet.title}" → ${winner} at ${formatPrice(point.price)} (${point.source}) tx=${sig}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      summary.errors.push({ betId: bet.id, error: msg });
      // Losing a race with another resolver / a user is expected; everything else is worth logging.
      if (!/InvalidState|EventNotOver|NotExpired|0x1775|0x177e|0x1781/.test(msg)) {
        log(`✗ ${bet.id} "${bet.title}": ${msg.split("\n")[0]}`);
      }
    }
  }
  return summary;
}
