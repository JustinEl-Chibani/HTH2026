// Shared by the web app (client + server) and scripts/. Relative imports only.
import { AnchorProvider, Program, type Provider } from "@anchor-lang/core";
import { Connection, PublicKey, type Commitment } from "@solana/web3.js";
import { Buffer } from "buffer";
import idlJson from "../idl/put_your_money.json";
import type { PutYourMoney } from "../idl/put_your_money";

export type { PutYourMoney };

export const PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID || idlJson.address);

// The generated type pins the literal address; allow overriding it via env for other deployments.
export const IDL = { ...(idlJson as PutYourMoney), address: PROGRAM_ID.toBase58() } as PutYourMoney;

export const COMMITMENT: Commitment = "confirmed";

export const CONFIG_SEED = Buffer.from("config");
export const BET_SEED = Buffer.from("bet");
export const VAULT_SEED = Buffer.from("vault");

export function rpcUrl(): string {
  return process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";
}

export function makeConnection(url = rpcUrl()): Connection {
  return new Connection(url, { commitment: COMMITMENT });
}

export function u64LeBytes(n: bigint): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(n);
  return b;
}

export function configPda(): PublicKey {
  return PublicKey.findProgramAddressSync([CONFIG_SEED], PROGRAM_ID)[0];
}

export function betPda(creator: PublicKey, betId: bigint): PublicKey {
  return PublicKey.findProgramAddressSync(
    [BET_SEED, creator.toBuffer(), u64LeBytes(betId)],
    PROGRAM_ID,
  )[0];
}

export function vaultPda(bet: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([VAULT_SEED, bet.toBuffer()], PROGRAM_ID)[0];
}

export function getProgram(provider: Provider): Program<PutYourMoney> {
  return new Program<PutYourMoney>(IDL, provider);
}

/** Read-only program client (account fetching / decoding) — no wallet needed. */
export function getReadonlyProgram(connection: Connection = makeConnection()): Program<PutYourMoney> {
  return new Program<PutYourMoney>(IDL, { connection } as Provider);
}

export { AnchorProvider };
