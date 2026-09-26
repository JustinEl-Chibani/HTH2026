// Server/scripts Solana context. Relative imports only (used by scripts/resolver.ts).
import { PublicKey, type Keypair } from "@solana/web3.js";
import { parseSecretKey } from "../solana/keys";
import { makeConnection } from "../solana/program";

let conn: ReturnType<typeof makeConnection> | null = null;
export function connection() {
  conn ??= makeConnection();
  return conn;
}

export function usdcMint(): PublicKey {
  const v = process.env.NEXT_PUBLIC_USDC_MINT;
  if (!v) throw new Error("NEXT_PUBLIC_USDC_MINT is not set — run `pnpm setup:devnet`");
  return new PublicKey(v);
}

let resolver: Keypair | null = null;
export function resolverKeypair(): Keypair {
  resolver ??= parseSecretKey(process.env.RESOLVER_SECRET_KEY, "RESOLVER_SECRET_KEY");
  return resolver;
}

let faucet: Keypair | null = null;
/** The test-USDC mint authority; also pays for faucet SOL top-ups. */
export function faucetKeypair(): Keypair {
  faucet ??= parseSecretKey(process.env.MINT_AUTHORITY_SECRET_KEY, "MINT_AUTHORITY_SECRET_KEY");
  return faucet;
}

export const USDC_DECIMALS = 6;
