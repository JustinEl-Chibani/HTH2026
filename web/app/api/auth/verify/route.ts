import bs58 from "bs58";
import nacl from "tweetnacl";
import { PublicKey } from "@solana/web3.js";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { badRequest, json, readJson, route, unauthorized } from "@/lib/server/api";
import { createSessionToken, setSessionCookie } from "@/lib/server/auth";
import { publicUser } from "@/lib/server/users";
import { buildSiwsMessage } from "@/lib/siws";
import { pubkeySchema, walletKindSchema } from "@/lib/validation";

const body = z.object({
  wallet: pubkeySchema,
  nonce: z.string().regex(/^[0-9a-f]{32}$/),
  signature: z.string().min(40).max(120),
  walletKind: walletKindSchema.optional(),
});

export const POST = route(async (req) => {
  const { wallet, nonce, signature, walletKind } = body.parse(await readJson(req));

  // One-time use: delete the nonce whether or not verification succeeds.
  const row = await prisma.authNonce.findUnique({ where: { nonce } });
  if (row) await prisma.authNonce.delete({ where: { nonce } });
  if (!row || row.wallet !== wallet || row.expiresAt < new Date()) {
    throw unauthorized("Sign-in request expired. Please try again.");
  }

  let sig: Uint8Array;
  try {
    sig = bs58.decode(signature);
  } catch {
    throw badRequest("Malformed signature");
  }
  const message = new TextEncoder().encode(buildSiwsMessage(wallet, nonce, row.createdAt));
  const ok = nacl.sign.detached.verify(message, sig, new PublicKey(wallet).toBytes());
  if (!ok) throw unauthorized("Signature didn't match that wallet.");

  // walletKind is set once (first sign-in that reports it) and never changes afterwards.
  let user = await prisma.user.upsert({
    where: { wallet },
    update: {},
    create: { wallet, avatarSeed: wallet, walletKind: walletKind ?? null },
  });
  if (!user.walletKind && walletKind) {
    user = await prisma.user.update({ where: { id: user.id }, data: { walletKind } });
  }
  await setSessionCookie(await createSessionToken(user));
  return json({ user: publicUser(user) });
});
