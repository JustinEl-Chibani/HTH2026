const cluster = () => process.env.NEXT_PUBLIC_EXPLORER_CLUSTER || "devnet";

function suffix(): string {
  const c = cluster();
  if (c === "mainnet-beta" || c === "mainnet") return "";
  if (c === "localnet" || c === "custom") {
    const url = encodeURIComponent(process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8899");
    return `?cluster=custom&customUrl=${url}`;
  }
  return `?cluster=${c}`;
}

export const explorerTx = (sig: string) => `https://explorer.solana.com/tx/${sig}${suffix()}`;
export const explorerAddress = (addr: string) =>
  `https://explorer.solana.com/address/${addr}${suffix()}`;
