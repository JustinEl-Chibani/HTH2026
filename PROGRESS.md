# PutYourMoney — Progress

## Phases
- [x] 1. Scaffold (pnpm monorepo, Next.js, Tailwind + shadcn, Anchor workspace, Prisma, README skeleton)
- [x] 2. Program (accounts, instructions, errors, events, test suite) — 15 LiteSVM tests passing (`pnpm anchor:test`)
- [~] 3. Devnet setup — `setup-devnet.ts` + `/api/faucet` done and verified on a local validator; **devnet deploy blocked on devnet SOL** (faucet rate-limited)
- [x] 4. Auth + users + friends (SIWS + JWT cookie, burner wallet adapter, onboarding, friend requests) — verified by `pnpm --filter scripts e2e --only auth`
- [x] 5. Create → counter → accept → fund flow — verified by API e2e (`pnpm --filter scripts e2e`) and a two-browser Playwright run (burner wallets)
- [x] 6. Resolution (mutual UI, resolver worker, settlement) — resolver e2e (touch early-YES, at-deadline NO, expiry) + full two-browser demo run settles with confetti
- [x] 7. Natural-language parsing + manual fallback — Claude structured outputs (`messages.parse` + Zod) with an offline heuristic parser when no key / AI error; unit tests via `pnpm --filter web test`
- [ ] 8. Odds mode, stats, history, notifications, share links
- [x] 9. Polish — friendly error mapping, skeletons, empty states, light/dark checked at 390px, production build passes
- [x] 10. Demo prep — `pnpm seed:demo` + `DEMO.md`; the full demo script passes in a two-browser Playwright run (typed bet → counter → accept → fund → resolver payout, plus mutual backup)
- [ ] 11. Stretch

## Decisions / deviations
- **Toolchain on Windows:** Rust/Solana/Anchor live in WSL (Ubuntu). `scripts/anchor.sh` rsyncs the Rust
  workspace to `~/pym-build` (native Linux FS; building on `/mnt/c` is very slow), runs anchor there,
  and copies IDL + TS types back to `web/lib/idl/`. Program keypair lives in `keys/` (gitignored) so the
  program ID is stable: `9gCvDMSSSqsCARyrubQTwUcC88U52YvM7CCd1zuUGZiG`.
- **Anchor 1.1.2** (installed CLI). Crates pinned to `=1.1.2` because the CLI refuses a newer anchor-lang.
  anchor-spl needs its default features (idl-build requires `token_2022`).
- **Program tests are Rust + LiteSVM** (Anchor 1.x default template; `anchor test` runs `cargo test`),
  not TS/mocha. WSL has no Node, and LiteSVM gives us clock warping for deadline tests.
- **TS client is `@anchor-lang/core`** (the Anchor 1.x successor to `@coral-xyz/anchor`, same API).
- **Next.js 15.5** (not 16): App Router, webpack dev server (web3.js polyfills are reliable there).
- **Prisma 6.19** (Prisma 7+ requires driver adapters for SQLite; 6 is zero-setup). Enums are strings.
- **shadcn/ui** uses the `radix-nova` style; `cn` comes from shadcn's `cn` package.
- **Wallets:** no `@solana/wallet-adapter-wallets`; Phantom/Solflare register via Wallet Standard. The
  burner wallet is a custom wallet-adapter so all code uses `useWallet()` uniformly.

- **Program design notes:**
  - Bet accounts are never closed (they are the on-chain receipt the DB syncs from); vaults are closed on
    every terminal state with rent back to the creator.
  - Mutual void = `propose_outcome(Void)` + `confirm_outcome` (no separate `void_mutual` ix).
  - `resolve_oracle` checks the claimed winner against the reported price (AboveAt/BelowAt must match;
    Touch YES must satisfy the threshold; Touch NO only after the deadline).
  - Price comparisons are inclusive (>= for above, <= for below).
  - `funding_deadline = min(accept + 30min, event_deadline)`; accept_deadline is clamped to the event
    deadline on counteroffers. Added `update_config` (admin) to rotate resolver/mint.
  - `initialize_config` is first-come (fine for devnet; would gate on upgrade authority for mainnet).

- **Local dev cluster:** while devnet SOL is unavailable, development runs against `solana-test-validator` in WSL
  (program preloaded with `--bpf-program`). `setup-devnet.ts --url http://127.0.0.1:8899 --write-env` points the app at it.
- **Two users in one machine:** sessions are cookies and the burner key is in localStorage, so use a normal window
  + a private/incognito window (or two browsers) for the two demo users.
- **Faucet** (`/api/faucet`): 100 test USDC (mint authority mints) or 0.05 SOL (sent from the mint-authority wallet),
  rate-limited per user. Burner wallets auto-request SOL after sign-in when their balance is low.
- **e2e script** (`scripts/e2e.ts`) drives the real API + program as two users (SIWS signing in node).

- **Prices:** Pyth Hermes has required an API key since 2026-08-26 (401 without one). `lib/prices.ts` uses Pyth when
  `PYTH_API_KEY` is set (Bearer auth) and falls back to CoinGecko; the source is recorded on every resolution.
- **Demo timing:** the demo helper defaults to a **3-minute** deadline (`NEXT_PUBLIC_DEMO_MINUTES`), not 2: create,
  counter, accept and both funds must all land before the event deadline (funding closes at the deadline).
- **Resolver** (`web/lib/server/resolver.ts`) runs every 5s by default (`RESOLVER_INTERVAL_MS`) via `pnpm resolver`, or one
  pass per call via `POST /api/cron/resolve` (Bearer `CRON_SECRET`). It uses the *current* price once the deadline has passed
  (not a historical price at exactly the deadline) and records source + publish time. Price chain: Pyth (with key) → Kraken → CoinGecko.
- **AI parsing:** `/api/parse-bet` uses `client.messages.parse()` + `zodOutputFormat` (structured outputs), model from
  `ANTHROPIC_MODEL` (default `claude-sonnet-5`), effort `low` for latency. The model output is normalized server-side
  (opponent must fuzzy-match a friend, future deadline, oracle/resolution consistency). **Not exercised live in this environment
  (no ANTHROPIC_API_KEY)** — without a key it falls back to a pattern-matching parser that handles the demo phrasing.
- **Faucet SOL** is 0.03 per claim; on a local validator it airdrops instead of spending the faucet wallet.
- **Demo links:** `seed-demo.ts` prints `/?demoKey=<burner secret>` links (burner-enabled builds only) so each demo window
  signs in as a fixed, pre-funded user.
- **Bet accounts share-link:** `/bet/[id]` is viewable by any signed-in member; signed-out visitors go through sign-in and come back.
- **Dev server:** webpack ignores `prisma/*.db` so SQLite writes don't trigger Fast Refresh mid-navigation.

## Blockers / notes
- Devnet airdrop to deploy wallet was rate-limited on first try (need ~3 SOL for deploy).
