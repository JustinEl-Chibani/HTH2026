// Runs the resolver inside the web server process (hosting with a single service).
// Enabled with RUN_RESOLVER_IN_APP=true; see instrumentation.ts. Locally, prefer `pnpm resolver`.
import { runResolverTick } from "./resolver";

let started = false;

export function startResolverLoop() {
  if (started) return;
  started = true;
  const interval = Number(process.env.RESOLVER_INTERVAL_MS ?? 5_000);
  const log = (m: string) => console.log(`[resolver] ${m}`);
  let running = false;
  log(`in-app resolver every ${interval / 1000}s`);
  setInterval(async () => {
    if (running) return; // never overlap ticks
    running = true;
    try {
      await runResolverTick(log);
    } catch (e) {
      log(`tick failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      running = false;
    }
  }, interval);
}
