import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { json, readJson, route } from "@/lib/server/api";
import { buildSiwsMessage } from "@/lib/siws";
import { pubkeySchema } from "@/lib/validation";

const NONCE_TTL_MS = 5 * 60 * 1000;

export const POST = route(async (req) => {
  const { wallet } = z.object({ wallet: pubkeySchema }).parse(await readJson(req));
  const nonce = randomBytes(16).toString("hex");
  const issuedAt = new Date();
  await prisma.authNonce.deleteMany({ where: { expiresAt: { lt: issuedAt } } });
  await prisma.authNonce.create({
    data: { nonce, wallet, createdAt: issuedAt, expiresAt: new Date(issuedAt.getTime() + NONCE_TTL_MS) },
  });
  return json({ nonce, message: buildSiwsMessage(wallet, nonce, issuedAt) });
});
