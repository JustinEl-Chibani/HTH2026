import {
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { json, readJson, route, tooMany } from "@/lib/server/api";
import { requireUser } from "@/lib/server/auth";
import { connection, faucetKeypair, usdcMint } from "@/lib/server/solana";
import { withRetry } from "@/lib/solana/retry";

const USDC_AMOUNT = 100_000_000n; // 100 test USDC
const SOL_AMOUNT = 0.05 * LAMPORTS_PER_SOL;
const LIMITS = { USDC: 10, SOL: 5 } as const; // per hour

export const POST = route(async (req) => {
  const user = await requireUser();
  const { kind } = z.object({ kind: z.enum(["USDC", "SOL"]) }).parse(await readJson(req));

  const recent = await prisma.faucetClaim.count({
    where: { userId: user.id, kind, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recent >= LIMITS[kind]) throw tooMany("Faucet limit reached — try again in an hour.");

  const conn = connection();
  const faucet = faucetKeypair();
  const owner = new PublicKey(user.wallet);
  const tx = new Transaction();
  if (kind === "USDC") {
    const mint = usdcMint();
    const ata = getAssociatedTokenAddressSync(mint, owner);
    tx.add(
      createAssociatedTokenAccountIdempotentInstruction(faucet.publicKey, ata, owner, mint),
      createMintToInstruction(mint, ata, faucet.publicKey, USDC_AMOUNT),
    );
  } else {
    tx.add(
      SystemProgram.transfer({ fromPubkey: faucet.publicKey, toPubkey: owner, lamports: SOL_AMOUNT }),
    );
  }
  const sig = await withRetry(() => sendAndConfirmTransaction(conn, tx, [faucet], { commitment: "confirmed" }));
  await prisma.faucetClaim.create({ data: { userId: user.id, kind, txSig: sig } });
  return json({ ok: true, txSig: sig });
});
