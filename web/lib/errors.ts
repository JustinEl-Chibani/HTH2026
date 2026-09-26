import idl from "./idl/put_your_money.json";
import { ApiClientError } from "./api-client";

/** Friendlier copy for the errors people actually hit during a bet. */
const OVERRIDES: Record<string, string> = {
  VersionMismatch: "That offer just changed — refresh to see the latest terms.",
  OwnProposal: "You made this offer — waiting on the other side to respond.",
  AcceptDeadlinePassed: "This offer expired before it was accepted.",
  FundingDeadlinePassed: "The funding window closed. The bet can be refunded.",
  AlreadyFunded: "You've already funded this bet.",
  NotParticipant: "Only the two people in this bet can do that.",
  InvalidState: "This bet has moved on — refresh to see where it's at.",
  EventNotOver: "Too early — the event deadline hasn't passed yet.",
  NotExpired: "Nothing to refund yet.",
  OwnOutcome: "You proposed this result — the other person needs to confirm it.",
  InvalidDeadlines: "Check the deadline — it needs to be in the future.",
  NotPublic: "Someone already took this bet.",
  PublicMustBeOracle: "Only price bets can be public. \"We agree\" bets are for friends.",
};

const BY_CODE = new Map<number, string>(
  (idl.errors as { code: number; name: string; msg?: string }[]).map((e) => [
    e.code,
    OVERRIDES[e.name] ?? e.msg ?? e.name,
  ]),
);

/** Turns wallet / RPC / Anchor / API errors into one short, human sentence. */
export function friendlyError(e: unknown): string {
  if (e instanceof ApiClientError) return e.message;
  const raw = e instanceof Error ? `${e.message} ${(e as { logs?: string[] }).logs?.join(" ") ?? ""}` : String(e);

  const num = raw.match(/Error Number: (\d+)/)?.[1] ?? null;
  const hex = raw.match(/custom program error: 0x([0-9a-f]+)/i)?.[1] ?? null;
  const code = num ? Number(num) : hex ? parseInt(hex, 16) : null;
  if (code !== null) {
    if (BY_CODE.has(code)) return BY_CODE.get(code)!;
    if (code === 1) return "Not enough USDC — grab some test USDC on your Profile.";
  }
  if (/user rejected|rejected the request|declined/i.test(raw)) return "You cancelled the request in your wallet.";
  if (/insufficient (funds|lamports)|debit an account|no record of a prior credit/i.test(raw))
    return "Not enough SOL for network fees — top up on your Profile.";
  if (/blockhash|timed? ?out|expired|429|fetch failed|network/i.test(raw))
    return "The network is slow right now. Give it a few seconds and refresh.";
  if (/wallet not connected|WalletNotConnected/i.test(raw)) return "Connect your wallet first.";
  const name = e instanceof Error ? e.name : "";
  if (/WalletSignMessageError/.test(name)) return "Your wallet couldn't sign the sign-in message. Try again, or try another wallet.";
  if (/WalletSignTransactionError|WalletSendTransactionError/.test(name))
    return "Your wallet couldn't send that transaction. Make sure it's on Solana Devnet and try again.";
  return "Something went wrong. Please try again.";
}
