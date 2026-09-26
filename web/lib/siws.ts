// Sign-In With Solana message format — shared by client (display/sign) and server (verify).
export const SIWS_DOMAIN = "PutYourMoney";

export function buildSiwsMessage(wallet: string, nonce: string, issuedAt: Date): string {
  return [
    `${SIWS_DOMAIN} wants you to sign in with your Solana account:`,
    wallet,
    "",
    "Sign in to PutYourMoney. This is free and does not send a transaction.",
    "",
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt.toISOString()}`,
  ].join("\n");
}
