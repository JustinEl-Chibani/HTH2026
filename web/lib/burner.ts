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

// Every burner account used in this browser, so people can log back in ("Continue as @justin").
const ACCOUNTS_KEY = "pym:burner-accounts";

interface StoredAccount {
  secret: string;
  wallet: string;
  label: string | null; // "@username" once known
  lastUsed: number;
}

export interface SavedBurnerAccount {
  wallet: string;
  label: string | null;
  lastUsed: number;
}

function readAccounts(): StoredAccount[] {
  try {
    const raw = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeAccounts(list: StoredAccount[]) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
}

function walletOf(secret58: string): string | null {
  try {
    return Keypair.fromSecretKey(bs58.decode(secret58)).publicKey.toBase58();
  } catch {
    return null;
  }
}

/** Add (or refresh) an account in this browser's saved list. */
function remember(secret58: string, label?: string | null) {
  const wallet = walletOf(secret58);
  if (!wallet) return;
  const all = readAccounts();
  const prev = all.find((a) => a.wallet === wallet);
  const list = all.filter((a) => a.wallet !== wallet);
  list.unshift({ secret: secret58, wallet, label: label ?? prev?.label ?? null, lastUsed: Date.now() });
  writeAccounts(list.slice(0, 20));
}

function loadOrCreate(): Keypair {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const kp = Keypair.fromSecretKey(bs58.decode(stored));
      remember(stored);
      return kp;
    } catch {
      /* fall through and regenerate */
    }
  }
  const kp = Keypair.generate();
  const secret = bs58.encode(kp.secretKey);
  localStorage.setItem(STORAGE_KEY, secret);
  remember(secret);
  return kp;
}

/**
 * Make a burner key the active one (from a login link / pasted key / the demo seed links).
 * Returns the wallet address, or null if the key is invalid.
 */
export function importBurnerSecret(secret58: string): string | null {
  const wallet = walletOf(secret58.trim());
  if (!wallet) return null;
  localStorage.setItem(STORAGE_KEY, secret58.trim());
  remember(secret58.trim());
  return wallet;
}

/** Pull the key out of a login link (`…?key=…` / `…?demoKey=…`) or accept a bare key. */
export function keyFromLoginInput(input: string): string | null {
  const s = input.trim();
  try {
    const url = new URL(s);
    const k = url.searchParams.get("key") ?? url.searchParams.get("demoKey");
    return k && walletOf(k) ? k : null;
  } catch {
    return walletOf(s) ? s : null;
  }
}

/** Burner accounts previously used in this browser, most recent first. */
export function listSavedBurners(): SavedBurnerAccount[] {
  return readAccounts().map(({ wallet, label, lastUsed }) => ({ wallet, label, lastUsed }));
}

/** Switch the active burner to a saved account. */
export function activateSavedBurner(wallet: string): boolean {
  const acct = readAccounts().find((a) => a.wallet === wallet);
  if (!acct) return false;
  localStorage.setItem(STORAGE_KEY, acct.secret);
  remember(acct.secret);
  return true;
}

/** Attach the username to a saved account once the user has one. */
export function labelSavedBurner(wallet: string, label: string) {
  const list = readAccounts();
  const acct = list.find((a) => a.wallet === wallet);
  if (acct && acct.label !== label) {
    acct.label = label;
    writeAccounts(list);
  }
}

export function forgetSavedBurner(wallet: string) {
  writeAccounts(readAccounts().filter((a) => a.wallet !== wallet));
  const active = localStorage.getItem(STORAGE_KEY);
  if (active && walletOf(active) === wallet) localStorage.removeItem(STORAGE_KEY);
}

/** A link that logs this burner account in on any browser. Treat it like a password. */
export function activeBurnerLoginLink(): string | null {
  const secret = localStorage.getItem(STORAGE_KEY);
  return secret && walletOf(secret) ? `${window.location.origin}/?key=${secret}` : null;
}

/**
 * Start a fresh burner identity on the next connect. The current account stays in the saved list,
 * so you can switch back to it from the sign-in page.
 */
export function resetBurner() {
  const active = localStorage.getItem(STORAGE_KEY);
  if (active) remember(active);
  localStorage.removeItem(STORAGE_KEY);
}

/** Make the burner the wallet the app auto-connects on next load (wallet-adapter's storage key). */
export function selectBurnerForNextLoad() {
  localStorage.setItem("walletName", JSON.stringify(BurnerWalletName));
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
