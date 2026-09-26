// Next.js calls register() once when the server starts.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.RUN_RESOLVER_IN_APP === "true") {
    const { startResolverLoop } = await import("./lib/server/resolver-loop");
    startResolverLoop();
  }
}
