"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import type { Adapter } from "@solana/wallet-adapter-base";
import { ThemeProvider } from "next-themes";
import { useMemo, useState, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { BurnerWalletAdapter } from "@/lib/burner";
import { rpcUrl } from "@/lib/solana/program";

export const BURNER_ENABLED = process.env.NEXT_PUBLIC_ENABLE_BURNER === "true";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 2_000, retry: 1, refetchOnWindowFocus: true } },
      }),
  );
  // Phantom / Solflare / Backpack register themselves via Wallet Standard; only the burner is explicit.
  const wallets = useMemo<Adapter[]>(() => (BURNER_ENABLED ? [new BurnerWalletAdapter()] : []), []);

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <ConnectionProvider endpoint={rpcUrl()} config={{ commitment: "confirmed" }}>
          <WalletProvider wallets={wallets} autoConnect>
            {children}
            <Toaster position="top-center" richColors closeButton />
          </WalletProvider>
        </ConnectionProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
