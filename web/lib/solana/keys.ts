// Server/scripts only: parse keypairs from env (base58 or JSON byte array).
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

export function parseSecretKey(value: string | undefined, name = "secret key"): Keypair {
  const v = value?.trim();
  if (!v) throw new Error(`${name} is not set`);
  try {
    if (v.startsWith("[")) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(v) as number[]));
    return Keypair.fromSecretKey(bs58.decode(v));
  } catch {
    throw new Error(`${name} is not a valid base58 or JSON-array secret key`);
  }
}

export function encodeSecretKey(kp: Keypair): string {
  return bs58.encode(kp.secretKey);
}
