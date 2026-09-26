/** Retries flaky RPC calls with exponential backoff (devnet RPC drops requests regularly). */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 4, baseMs = 400): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (!isRetryable(e) || i === attempts - 1) break;
      await new Promise((r) => setTimeout(r, baseMs * 2 ** i));
    }
  }
  throw lastErr;
}

function isRetryable(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  // Program/logic errors will fail again; only retry transport-level problems.
  if (/custom program error|AnchorError|Simulation failed|insufficient/i.test(msg)) return false;
  return true;
}
