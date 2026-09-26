/**
 * One-time cluster setup (idempotent — safe to re-run):
 *  - generates/loads keypairs in keys/ (admin, resolver, mint authority, test-USDC mint)
 *  - airdrops SOL (or transfers from --funder) so they can pay fees
 *  - creates the 6-decimal "Test USDC" mint
 *  - initializes (or updates) the program Config (resolver + allowed mint)
 *  - prints the env values, and with --write-env writes them into web/.env.local
 *
 * Usage: pnpm setup:devnet [--url http://127.0.0.1:8899] [--funder path/to/keypair.json] [--write-env]
 */
import { REPO_ROOT, arg, flag, redactUrl } from "./env";
import { AnchorProvider, Wallet } from "@anchor-lang/core";
import { createMint, getMint } from "@solana/spl-token";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  type Connection,
} from "@solana/web3.js";
import fs from "node:fs";
import path from "node:path";
import { encodeSecretKey } from "../web/lib/solana/keys";
import { configPda, getProgram, makeConnection, PROGRAM_ID } from "../web/lib/solana/program";

const KEYS_DIR = path.join(REPO_ROOT, "keys");

function loadOrCreateKeypair(name: string): Keypair {
  const file = path.join(KEYS_DIR, `${name}.json`);
  if (fs.existsSync(file)) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(file, "utf8"))));
  }
  const kp = Keypair.generate();
  fs.mkdirSync(KEYS_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(Array.from(kp.secretKey)));
  console.log(`  generated keys/${name}.json → ${kp.publicKey.toBase58()}`);
  return kp;
}

async function ensureSol(conn: Connection, who: Keypair, label: string, min: number, funder?: Keypair) {
  const bal = await conn.getBalance(who.publicKey);
  if (bal >= min * LAMPORTS_PER_SOL) {
    console.log(`  ${label}: ${(bal / LAMPORTS_PER_SOL).toFixed(3)} SOL ✓`);
    return;
  }
  const need = min * LAMPORTS_PER_SOL - bal;
  if (funder) {
    const tx = new Transaction().add(
      SystemProgram.transfer({ fromPubkey: funder.publicKey, toPubkey: who.publicKey, lamports: need }),
    );
    await sendAndConfirmTransaction(conn, tx, [funder]);
    console.log(`  ${label}: funded ${(need / LAMPORTS_PER_SOL).toFixed(3)} SOL from funder ✓`);
    return;
  }
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const sig = await conn.requestAirdrop(who.publicKey, Math.min(need, 2 * LAMPORTS_PER_SOL));
      await conn.confirmTransaction(sig, "confirmed");
      console.log(`  ${label}: airdropped ✓`);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  throw new Error(
    `Could not airdrop to ${label} (${who.publicKey.toBase58()}). Devnet faucet is rate-limited: ` +
      `send it ~${min} SOL from https://faucet.solana.com, or re-run with --funder <keypair.json>.`,
  );
}

function upsertEnv(file: string, values: Record<string, string>) {
  let text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  for (const [k, v] of Object.entries(values)) {
    const line = `${k}=${v}`;
    const re = new RegExp(`^${k}=.*$`, "m");
    text = re.test(text) ? text.replace(re, line) : `${text.trimEnd()}\n${line}\n`;
  }
  fs.writeFileSync(file, text);
}

async function main() {
  const url = arg("url") ?? process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com";
  const conn = makeConnection(url);
  console.log(`\nPutYourMoney setup → ${redactUrl(url)}\n   program ${PROGRAM_ID.toBase58()}\n`);

  const programInfo = await conn.getAccountInfo(PROGRAM_ID);
  if (!programInfo?.executable) {
    throw new Error(
      `Program ${PROGRAM_ID.toBase58()} is not deployed on ${url}. Run \`pnpm anchor:deploy\` first.`,
    );
  }

  const funderPath = arg("funder");
  const funder = funderPath
    ? Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(funderPath, "utf8"))))
    : undefined;

  console.log("Keys:");
  const admin = loadOrCreateKeypair("admin");
  const resolver = loadOrCreateKeypair("resolver");
  const mintAuthority = loadOrCreateKeypair("mint-authority");
  const mintKp = loadOrCreateKeypair("usdc-mint");

  console.log("\nSOL balances:");
  await ensureSol(conn, admin, "admin", 0.1, funder);
  await ensureSol(conn, resolver, "resolver", 0.3, funder);
  await ensureSol(conn, mintAuthority, "mint authority (faucet)", 1, funder);

  console.log("\nTest USDC mint:");
  let mint: PublicKey;
  try {
    const existing = await getMint(conn, mintKp.publicKey);
    mint = existing.address;
    console.log(`  exists: ${mint.toBase58()} (decimals ${existing.decimals}) ✓`);
  } catch {
    mint = await createMint(conn, admin, mintAuthority.publicKey, null, 6, mintKp);
    console.log(`  created: ${mint.toBase58()} ✓`);
  }

  console.log("\nProgram config:");
  const program = getProgram(
    new AnchorProvider(conn, new Wallet(admin), { commitment: "confirmed" }),
  );
  const cfgAddr = configPda();
  const cfg = await program.account.config.fetchNullable(cfgAddr);
  if (!cfg) {
    const sig = await program.methods
      .initializeConfig(resolver.publicKey)
      .accountsPartial({ admin: admin.publicKey, config: cfgAddr, usdcMint: mint })
      .rpc();
    console.log(`  initialized ${cfgAddr.toBase58()} (${sig}) ✓`);
  } else if (!cfg.resolver.equals(resolver.publicKey) || !cfg.usdcMint.equals(mint)) {
    if (!cfg.admin.equals(admin.publicKey)) {
      throw new Error(`Config exists with a different admin (${cfg.admin.toBase58()}).`);
    }
    const sig = await program.methods
      .updateConfig(resolver.publicKey)
      .accountsPartial({ admin: admin.publicKey, config: cfgAddr, usdcMint: mint })
      .rpc();
    console.log(`  updated resolver/mint (${sig}) ✓`);
  } else {
    console.log(`  ${cfgAddr.toBase58()} already configured ✓`);
  }

  const env = {
    NEXT_PUBLIC_RPC_URL: url,
    NEXT_PUBLIC_PROGRAM_ID: PROGRAM_ID.toBase58(),
    NEXT_PUBLIC_USDC_MINT: mint.toBase58(),
    RESOLVER_SECRET_KEY: encodeSecretKey(resolver),
    MINT_AUTHORITY_SECRET_KEY: encodeSecretKey(mintAuthority),
  };
  if (url.includes("127.0.0.1") || url.includes("localhost")) {
    Object.assign(env, { NEXT_PUBLIC_EXPLORER_CLUSTER: "localnet" });
  } else if (url.includes("devnet")) {
    Object.assign(env, { NEXT_PUBLIC_EXPLORER_CLUSTER: "devnet" });
  }

  console.log("\nEnv values for web/.env.local:\n");
  for (const [k, v] of Object.entries(env)) {
    const shown = k.includes("SECRET") ? `${v.slice(0, 6)}…(${v.length} chars)` : redactUrl(v);
    console.log(`  ${k}=${shown}`);
  }
  if (flag("write-env")) {
    upsertEnv(path.join(REPO_ROOT, "web", ".env.local"), env);
    console.log("\n  ✓ written to web/.env.local");
  } else {
    console.log("\n  (re-run with --write-env to write these into web/.env.local)");
  }
}

main().catch((e) => {
  console.error(`\n✗ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
