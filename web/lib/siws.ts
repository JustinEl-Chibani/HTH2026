// Sign-in message — shared by client (sign) and server (verify).
//
// Deliberately NOT in the formal Sign-In With Solana format ("<domain> wants you to sign in with your
// Solana account:"). Wallets like Phantom parse that format and reject it when <domain> doesn't match
// the site's host, which varies between localhost, Railway and a custom domain. A plain message signs
// everywhere and is verified the same way (nonce + ed25519 signature).
export function buildSiwsMessage(wallet: string, nonce: string, issuedAt: Date): string {
  return [
    "Sign in to PutYourMoney",
    "",
    "This proves you own this wallet. It's free and does not send a transaction.",
    "",
    `Wallet: ${wallet}`,
    `Nonce: ${nonce}`,
    `Issued at: ${issuedAt.toISOString()}`,
  ].join("\n");
}
