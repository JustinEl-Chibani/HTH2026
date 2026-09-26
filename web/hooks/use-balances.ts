"use client";

import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useQuery } from "@tanstack/react-query";

const MINT = process.env.NEXT_PUBLIC_USDC_MINT;

export function useBalances(wallet: string | null | undefined) {
  const { connection } = useConnection();
  return useQuery({
    queryKey: ["balances", wallet],
    enabled: !!wallet,
    refetchInterval: 10_000,
    queryFn: async () => {
      const owner = new PublicKey(wallet!);
      const lamports = await connection.getBalance(owner);
      let usdc = 0n;
      if (MINT) {
        const ata = getAssociatedTokenAddressSync(new PublicKey(MINT), owner);
        try {
          const bal = await connection.getTokenAccountBalance(ata);
          usdc = BigInt(bal.value.amount);
        } catch {
          usdc = 0n; // no token account yet
        }
      }
      return { lamports, usdc };
    },
  });
}
