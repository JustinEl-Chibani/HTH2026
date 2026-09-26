# PutYourMoney — Progress

## Phases
- [x] 1. Scaffold (pnpm monorepo, Next.js, Tailwind + shadcn, Anchor workspace, Prisma, README skeleton)
- [ ] 2. Program (accounts, instructions, errors, events, test suite)
- [ ] 3. Devnet setup (deploy, setup-devnet.ts, faucet, env)
- [ ] 4. Auth + users + friends
- [ ] 5. Create → counter → accept → fund flow
- [ ] 6. Resolution (mutual UI, resolver worker, settlement)
- [ ] 7. Natural-language parsing + manual fallback
- [ ] 8. Odds mode, stats, history, notifications, share links
- [ ] 9. Polish
- [ ] 10. Demo prep (seed-demo.ts, DEMO.md)
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

## Blockers / notes
- Devnet airdrop to deploy wallet was rate-limited on first try (need ~3 SOL for deploy).
