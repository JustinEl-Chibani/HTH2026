/**
 * Resolver worker: every few seconds, settles oracle bets from live prices and refunds anything
 * past its deadlines. Signs with RESOLVER_SECRET_KEY (the program's configured resolver).
 *
 * Usage: pnpm resolver [--once] [--interval 5000]
 */
import { arg, flag } from "./env";
import { runResolverTick } from "../web/lib/server/resolver";
import { resolverKeypair } from "../web/lib/server/solana";

const interval = Number(arg("interval") ?? process.env.RESOLVER_INTERVAL_MS ?? 5_000);
const ts = () => new Date().toLocaleTimeString();
const log = (m: string) => console.log(`[${ts()}] ${m}`);

async function main() {
  log(`🧑‍⚖️ resolver ${resolverKeypair().publicKey.toBase58()} · every ${interval / 1000}s · ${process.env.NEXT_PUBLIC_RPC_URL}`);
  do {
    try {
      const s = await runResolverTick(log);
      if (s.checked && !s.resolved.length && !s.refunded.length && flag("verbose")) log(`checked ${s.checked} open bets`);
    } catch (e) {
      log(`tick failed: ${e instanceof Error ? e.message : e}`);
    }
    if (flag("once")) break;
    await new Promise((r) => setTimeout(r, interval));
  } while (true);
}

main();
