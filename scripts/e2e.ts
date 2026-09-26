/**
 * End-to-end API walkthrough against a running app (`pnpm dev`) + cluster (local validator or devnet).
 * Two throwaway users sign in with SIWS, become friends, claim faucet funds, then run bets through
 * the real program exactly like the browser does (sign tx locally → POST /sync).
 *
 * Usage: pnpm --filter scripts e2e [--base http://localhost:3000] [--only auth]
 */
import { arg } from "./env";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";

export const BASE = arg("base") ?? "http://localhost:3000";

export class Client {
  cookie = "";
  constructor(
    public kp: Keypair,
    public label: string,
  ) {}

  get wallet() {
    return this.kp.publicKey.toBase58();
  }

  async req<T>(path: string, body?: unknown, method?: string): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      method: method ?? (body === undefined ? "GET" : "POST"),
      headers: {
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(this.cookie ? { cookie: this.cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) this.cookie = setCookie.split(";")[0];
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) throw new Error(`${this.label} ${path} → ${res.status}: ${data?.error ?? text}`);
    return data as T;
  }

  async signIn(username: string) {
    const { nonce, message } = await this.req<{ nonce: string; message: string }>("/api/auth/nonce", {
      wallet: this.wallet,
    });
    const sig = nacl.sign.detached(new TextEncoder().encode(message), this.kp.secretKey);
    await this.req("/api/auth/verify", { wallet: this.wallet, nonce, signature: bs58.encode(sig) });
    const { user } = await this.req<{ user: { id: string; username: string } }>("/api/users/username", {
      username,
      displayName: username[0].toUpperCase() + username.slice(1, username.indexOf("_") > 0 ? username.indexOf("_") : undefined),
    });
    return user;
  }
}

export function ok(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`✗ ${msg}`);
  console.log(`  ✓ ${msg}`);
}

export async function expectFail(p: Promise<unknown>, msg: string) {
  try {
    await p;
  } catch (e) {
    console.log(`  ✓ ${msg} (${(e as Error).message.split("→").pop()?.trim().slice(0, 80)})`);
    return;
  }
  throw new Error(`✗ expected failure: ${msg}`);
}

export async function authAndFriends() {
  const tag = Math.random().toString(36).slice(2, 6);
  const a = new Client(Keypair.generate(), "justin");
  const b = new Client(Keypair.generate(), "alex");
  console.log("\n[auth]");
  await expectFail(a.req("/api/friends"), "unauthenticated request is rejected");
  const ua = await a.signIn(`justin_${tag}`);
  const ub = await b.signIn(`alex_${tag}`);
  ok(ua.username === `justin_${tag}`, "justin signed in + onboarded");
  const me = await a.req<{ user: { wallet: string } }>("/api/me");
  ok(me.user.wallet === a.wallet, "/api/me returns the session wallet");

  // Replaying a used nonce must fail.
  const { nonce, message } = await a.req<{ nonce: string; message: string }>("/api/auth/nonce", { wallet: a.wallet });
  const sig = bs58.encode(nacl.sign.detached(new TextEncoder().encode(message), a.kp.secretKey));
  await a.req("/api/auth/verify", { wallet: a.wallet, nonce, signature: sig });
  await expectFail(a.req("/api/auth/verify", { wallet: a.wallet, nonce, signature: sig }), "nonce replay rejected");
  // Signature from the wrong key must fail.
  const n2 = await b.req<{ nonce: string; message: string }>("/api/auth/nonce", { wallet: a.wallet });
  const badSig = bs58.encode(nacl.sign.detached(new TextEncoder().encode(n2.message), b.kp.secretKey));
  await expectFail(b.req("/api/auth/verify", { wallet: a.wallet, nonce: n2.nonce, signature: badSig }), "forged signature rejected");
  await expectFail(a.req("/api/users/username", { username: `alex_${tag}` }), "duplicate username rejected");

  console.log("\n[friends]");
  const search = await a.req<{ users: { username: string }[] }>(`/api/users/search?q=alex_${tag}`);
  ok(search.users.some((u) => u.username === `alex_${tag}`), "search finds alex");
  const sent = await a.req<{ status: string }>("/api/friends", { username: `alex_${tag}` });
  ok(sent.status === "PENDING", "friend request pending");
  const bf = await b.req<{ incoming: { friendshipId: string }[] }>("/api/friends");
  ok(bf.incoming.length === 1, "alex sees incoming request");
  await b.req(`/api/friends/${bf.incoming[0].friendshipId}/accept`, {});
  const af = await a.req<{ friends: { user: { username: string } }[] }>("/api/friends");
  ok(af.friends[0]?.user.username === `alex_${tag}`, "justin and alex are friends");
  const notes = await a.req<{ unread: number }>("/api/notifications?countOnly=1");
  ok(notes.unread >= 1, "justin got a notification");

  console.log("\n[faucet]");
  for (const c of [a, b]) {
    await c.req("/api/faucet", { kind: "SOL" });
    await c.req("/api/faucet", { kind: "USDC" });
  }
  ok(true, "both users got SOL + 100 test USDC");
  return { a, b, tag };
}

async function main() {
  const only = arg("only");
  const ctx = await authAndFriends();
  if (only === "auth") return;
  const { betFlows } = await import("./e2e-bets");
  await betFlows(ctx);
}

if (process.argv[1]?.endsWith("e2e.ts")) {
  main()
    .then(() => console.log("\n✅ e2e passed\n"))
    .catch((e) => {
      console.error(`\n${e instanceof Error ? e.stack : e}\n`);
      process.exit(1);
    });
}
