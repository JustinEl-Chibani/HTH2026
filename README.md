# PutYourMoney 💸

> Put your money where your mouth is.

Friends turn casual bets into on-chain agreements on **Solana devnet**: write a bet in plain English,
negotiate stakes with counteroffers, lock test-USDC in a program escrow, and let a price oracle (or
mutual agreement) pay the whole pot to the winner.

_Full README is written in the final phase — see `PROGRESS.md` for current status._

## Repo layout
| Path | What |
| --- | --- |
| `web/` | Next.js app (UI + API route handlers + Prisma/SQLite) |
| `programs/put_your_money/` | Anchor program (escrow + negotiation state machine) |
| `scripts/` | devnet setup, resolver worker, demo seed |

## Prerequisites
- Node 22 + pnpm 10
- WSL (Ubuntu) with Rust, Solana CLI 3.x and Anchor CLI 1.1.2 (Windows) — or the same natively on macOS/Linux

## Quick start
```bash
pnpm install
cp web/.env.example web/.env.local   # then fill in values
pnpm --filter web db:push
pnpm anchor:build
pnpm dev
```
