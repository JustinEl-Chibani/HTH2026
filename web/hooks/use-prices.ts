"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { FeedStr } from "@/lib/solana/codec";

export type ClientPrices = Record<FeedStr, { price: string; source: string; publishTime: number }>;

export function usePrices(enabled = true) {
  return useQuery({
    queryKey: ["prices"],
    enabled,
    refetchInterval: 5_000,
    queryFn: () => api<{ prices: ClientPrices | null }>("/api/prices").then((r) => r.prices),
  });
}
