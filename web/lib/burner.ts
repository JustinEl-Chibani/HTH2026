"use client";
// Dev-only in-browser wallet so two people can demo from two browser windows without Phantom.
// The secret key lives in localStorage — never use this for anything real.
import {
  BaseMessageSignerWalletAdapter,
  WalletNotConnectedError,
  WalletReadyState,
  isVersionedTransaction,
  type SupportedTransactionVersions,
  type TransactionOrVersionedTransaction,
  type WalletName,
} from "@solana/wallet-adapter-base";
import { Keypair, type PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";

export const BurnerWalletName = "Burner wallet" as WalletName<"Burner wallet">;
const STORAGE_KEY = "pym:burner-secret";

const ICON =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#b6f03c"/><text x="32" y="44" font-size="34" text-anchor="middle">🔥</text></svg>',
  );

function loadOrCreate(): Keypair {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return Keypair.fromSecretKey(bs58.decode(stored));
    } catch {
      /* fall through and regenerate */
    }
  }
  const kp = Keypair.generate();
  localStorage.setItem(STORAGE_KEY, bs58.encode(kp.secretKey));
  return kp;
}

/**
 * Load a known burner key (the demo seed script prints `/?demoKey=…` links for justin/alex).
 * Returns the wallet address, or null if the key is invalid.
 */
export function importBurnerSecret(secret58: string): string | null {
  try {
    const kp = Keypair.fromSecretKey(bs58.decode(secret58));
    localStorage.setItem(STORAGE_KEY, secret58);
    return kp.publicKey.toBase58();
  } catch {
    return null;
  }
}

/** Forget the burner key so the next connect creates a brand-new identity. */
export function resetBurner() {
  localStorage.removeItem(STORAGE_KEY);
}

export class BurnerWalletAdapter extends BaseMessageSignerWalletAdapter<"Burner wallet"> {
  name = BurnerWalletName;
  url = "https://solana.com/docs";
  icon = ICON;
  supportedTransactionVersions: SupportedTransactionVersions = new Set(["legacy", 0] as const);

  private _keypair: Keypair | null = null;
  private _connecting = false;

  get publicKey(): PublicKey | null {
    return this._keypair?.publicKey ?? null;
  }

  get connecting(): boolean {
    return this._connecting;
  }

  get readyState(): WalletReadyState {
    return typeof window === "undefined" ? WalletReadyState.Unsupported : WalletReadyState.Loadable;
  }

  async connect(): Promise<void> {
    if (this._keypair) return;
    this._connecting = true;
    try {
      this._keypair = loadOrCreate();
      this.emit("connect", this._keypair.publicKey);
    } finally {
      this._connecting = false;
    }
  }

  async disconnect(): Promise<void> {
    this._keypair = null;
    this.emit("disconnect");
  }

  private keypair(): Keypair {
    if (!this._keypair) throw new WalletNotConnectedError();
    return this._keypair;
  }

  async signTransaction<T extends TransactionOrVersionedTransaction<this["supportedTransactionVersions"]>>(
    tx: T,
  ): Promise<T> {
    const kp = this.keypair();
    if (isVersionedTransaction(tx)) tx.sign([kp]);
    else tx.partialSign(kp);
    return tx;
  }

  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    return nacl.sign.detached(message, this.keypair().secretKey);
  }
}
