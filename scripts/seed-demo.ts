/**
 * Demo prep (idempotent): creates users `justin` and `alex` with fixed burner keys, makes them
 * friends, tops them up with SOL + test USDC, and prints one-click login links for two windows.
 *
 * Usage: pnpm seed:demo [--app http://localhost:3000] [--reset-bets] [--usdc 500]
 */
import { arg, flag, redactUrl, REPO_ROOT } from "./env";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Keypair, LAMPORTS_PER_SOL, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../web/lib/db";
import { connection, faucetKeypair, usdcMint } from "../web/lib/server/solana";

const APP = arg("app") ?? "http://localhost:3000";
const USDC_TARGET = BigInt(Number(arg("usdc") ?? 500)) * 1_000_000n;
const SOL_TARGET = 0.1 * LAMPORTS_PER_SOL;

const PEOPLE = [
  { username: "justin", displayName: "Justin" },
  { username: "alex", displayName: "Alex" },
];

function demoKeypair(username: string): Keypair {
  const file = path.join(REPO_ROOT, "keys", `demo-${username}.json`);
  if (fs.existsSync(file)) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(file, "utf8"))));
  const kp = Keypair.generate();
  fs.writeFileSync(file, JSON.stringify(Array.from(kp.secretKey)));
  return kp;
}

async function topUp(kp: Keypair) {
  const conn = connection();
  const faucet = faucetKeypair();
  const isLocal = /localhost|127\.0\.0\.1/.test(conn.rpcEndpoint);
  const bal = await conn.getBalance(kp.publicKey);
  if (bal < SOL_TARGET) {
    if (isLocal) {
      await conn.confirmTransaction(await conn.requestAirdrop(kp.publicKey, 2 * LAMPORTS_PER_SOL), "confirmed");
    } else {
      await sendAndConfirmTransaction(
        conn,
        new Transaction().add(SystemProgram.transfer({ fromPubkey: faucet.publicKey, toPubkey: kp.publicKey, lamports: SOL_TARGET - bal })),
        [faucet],
      );
    }
  }
  const mint = usdcMint();
  const ata = getAssociatedTokenAddressSync(mint, kp.publicKey);
  let usdc = 0n;
  try {
    usdc = BigInt((await conn.getTokenAccountBalance(ata)).value.amount);
  } catch {
    /* no ATA yet */
  }
  if (usdc < USDC_TARGET) {
    await sendAndConfirmTransaction(
      conn,
      new Transaction().add(
        createAssociatedTokenAccountIdempotentInstruction(faucet.publicKey, ata, kp.publicKey, mint),
        createMintToInstruction(mint, ata, faucet.publicKey, USDC_TARGET - usdc),
      ),
      [faucet],
    );
    usdc = USDC_TARGET;
  }
  const sol = (await conn.getBalance(kp.publicKey)) / LAMPORTS_PER_SOL;
  return { sol, usdc: Number(usdc) / 1e6 };
}

async function main() {
  console.log(`\n🎬 Seeding demo users on ${redactUrl(connection().rpcEndpoint)}\n`);
  const users = [];
  for (const p of PEOPLE) {
    const kp = demoKeypair(p.username);
    const wallet = kp.publicKey.toBase58();
    // Free the username if some other wallet grabbed it during testing.
    const holder = await prisma.user.findUnique({ where: { username: p.username } });
    if (holder && holder.wallet !== wallet) {
      await prisma.user.update({ where: { id: holder.id }, data: { username: `${p.username}_${holder.id.slice(-4)}` } });
    }
    const user = await prisma.user.upsert({
      where: { wallet },
      update: { username: p.username, displayName: p.displayName, walletKind: "BURNER" },
      create: { wallet, username: p.username, displayName: p.displayName, avatarSeed: wallet, walletKind: "BURNER" },
    });
    const funds = await topUp(kp);
    console.log(`  @${p.username.padEnd(7)} ${wallet}  ${funds.sol.toFixed(3)} SOL · $${funds.usdc} test USDC`);
    users.push({ user, kp });
  }

  const [a, b] = users.map((u) => u.user);
  const existing = await prisma.friendship.findFirst({
    where: { OR: [{ requesterId: a.id, addresseeId: b.id }, { requesterId: b.id, addresseeId: a.id }] },
  });
  if (existing) await prisma.friendship.update({ where: { id: existing.id }, data: { status: "ACCEPTED" } });
  else await prisma.friendship.create({ data: { requesterId: a.id, addresseeId: b.id, status: "ACCEPTED" } });
  console.log("  🤝 justin ↔ alex are friends");

  if (flag("reset-bets")) {
    const ids = users.map((u) => u.user.id);
    const del = await prisma.bet.deleteMany({ where: { OR: [{ creatorId: { in: ids } }, { opponentId: { in: ids } }] } });
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    console.log(`  🧹 cleared ${del.count} old bets + notifications from the DB (on-chain accounts untouched)`);
  }

  console.log("\nOpen these in two separate browser profiles (e.g. a normal window + an incognito window):\n");
  for (const { user, kp } of users) {
    console.log(`  ${user.displayName?.padEnd(7)} ${APP}/?demoKey=${bs58.encode(kp.secretKey)}`);
  }
  console.log("\n  (Devnet test keys only — never put real funds on these.)\n");
}

main()
  .catch((e) => {
    console.error(`\n✗ ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
