# PutYourMoney: demo script

About 5 minutes. Two users, Justin and Alex, in two browser windows. The main bet is a live SOL price bet
with a 3-minute deadline that the resolver settles on camera. The backup is a mutual bet that settles
instantly.

## Before you present (10 min early)

1. **Start everything**, each in its own terminal:
   ```bash
   pnpm dev
   pnpm resolver
   ```
   The resolver should print `🧑‍⚖️ resolver <address> · every 5s`.
2. **Seed the demo users.** This creates `@justin` and `@alex`, makes them friends, tops each up to $500
   of test USDC plus fee SOL, and clears old bets from the home screens:
   ```bash
   pnpm seed:demo --reset-bets
   ```
   It prints two links, `http://localhost:3000/?demoKey=…`.
3. **Open the windows:**
   - **Window A (Justin):** a normal browser window. Paste Justin's link.
   - **Window B (Alex):** a **private/incognito** window, or a second browser. Paste Alex's link.

   Each lands on Home, already signed in. Put them side by side at phone width (DevTools device mode at
   390px looks great).
4. **Warm up:** click through Home → New bet → Profile once in each window so nothing compiles on stage.
   Check that Profile shows $500.

> **Sanity check:** Window A's New bet screen shows the live SOL price under the example chips. If prices
> are down, `curl localhost:3000/api/prices` should return JSON.

## The script

**1. The pitch (Window A, Home).** "Friends bet each other all the time: 'I bet you $10…'. Then nobody pays.
PutYourMoney turns that into an agreement enforced by a Solana program."

**2. Justin makes the bet (Window A).**
- Tap the big **+**, then **⚡ Demo**. It prefills *"I bet @alex $10 SOL is above $[current price] in 3
  minutes"* and opens the review card directly. (Or type it and tap **Make it a bet** to show AI parsing.)
- Point out that every field is editable: opponent, precise YES condition, price oracle, deadline, and
  the stake math ("You risk $10 to win $10 · Pot $20").
- Tap **Send challenge to Alex**. The toast says *Challenge sent* with **View on Solana**.

**3. Alex counters (Window B).**
- Home shows **🔥 Needs your action · New challenge**. Open it.
- Tap **Counter**, choose **Custom**, set **You put in $50** and **Justin puts in $10**, then **Send v2**.
- "Alex thinks he's got it, so he takes NO for $50. Each counteroffer is a new on-chain version."

**4. Justin accepts (Window A).**
- The bet page updates by itself. The negotiation timeline shows **v1 → v2**.
- Tap **Accept v2**. "The program only lets him accept the exact version he's looking at. Terms can't
  change under him."

**5. Both fund.**
- Window A: **Fund $10**. Window B: **Fund $50**.
- Both windows show **$60 locked in escrow**, both **Funded ✓**, and the live SOL price bar against the
  target with the countdown. Tap **vault** to show the escrow account on Explorer.

**6. While the clock runs: the backup mutual bet** (fills the ~2 minutes and covers you if the resolver
or RPC is slow).
- Window A: **+** → type *"$20 says @alex can't run a 5K under 25 minutes this week"* → **Make it a
  bet** → **Send**.
- Window B: open it → **Accept v1** → **Fund $20**. Window A: **Fund $20**.
- Window A: **I won** (Justin swears Alex didn't make it). Window B: **Confirm**, and the confetti
  settles it instantly. "Subjective bets settle when both people agree. If they dispute, it goes back to
  live and refunds after 48 hours."

**7. The oracle bet settles.**
- Go back to the SOL bet. At zero, the resolver fires within a few seconds. The winner's window gets
  confetti and **You won! $60 → …**, with *"Resolved by Kraken: SOL = $… at …"*.
- Tap **View payout on Solana** to show the settlement transaction on Explorer.

**8. Close (Profile / Home).** The record and net winnings update, and there's head-to-head vs your friend.
"Social app on top, Solana escrow underneath. Nobody can welch."

## If something goes wrong

| Symptom | Fix |
| --- | --- |
| "Wallet disconnected" banner | Tap **Reconnect**, then **Try with a burner wallet**. The key is still in that window. |
| A window shows the wrong person | Re-open that person's `?demoKey=` link in that window. |
| "Not enough USDC" | Profile → **Get $100**. |
| Oracle bet didn't settle | Check the `pnpm resolver` terminal. If it isn't running, start it. It settles overdue bets on its first pass. |
| Funding window closed before both funded | That bet refunds automatically. Use the mutual backup bet, or make a new ⚡ Demo bet. |
| RPC slow | Toasts say "The network is slow". The page self-refreshes every 3s; give it a moment. |

## Timings
- The demo bet uses a **3-minute** deadline (`NEXT_PUBLIC_DEMO_MINUTES`). Challenge, counter, accept and
  both funds must land before the deadline, because funding closes at the event deadline. In rehearsal
  that took about 30 seconds.
- The resolver checks every 5 seconds, so settlement lands 0–10 seconds after the countdown hits zero.
