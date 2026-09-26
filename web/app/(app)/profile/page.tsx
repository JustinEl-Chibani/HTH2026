"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, Fuel, KeyRound, Loader2, LogOut, Moon, RefreshCw, Sun, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader, SectionTitle } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { useBalances } from "@/hooks/use-balances";
import { logout, useMe, type Me } from "@/hooks/use-session";
import { api } from "@/lib/api-client";
import { BurnerWalletName, activeBurnerLoginLink, resetBurner } from "@/lib/burner";
import { friendlyError } from "@/lib/errors";
import { shortAddress } from "@/lib/format";
import { formatUsd } from "@/lib/money";
import { explorerAddress, explorerTx } from "@/lib/solana/explorer";
import { cn } from "@/lib/utils";

interface Stats {
  record: { wins: number; losses: number; net: string };
  activeCount: number;
  vsFriends: { user: Me; record: { wins: number; losses: number; net: string } }[];
}

export default function ProfilePage() {
  const { data: me } = useMe();
  const { disconnect, wallet } = useWallet();
  const qc = useQueryClient();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const balances = useBalances(me?.wallet);
  const stats = useQuery({ queryKey: ["stats"], queryFn: () => api<Stats>("/api/stats/me") });
  const [claiming, setClaiming] = useState<"USDC" | "SOL" | null>(null);

  if (!me) return null;
  const isBurner = wallet?.adapter.name === BurnerWalletName;

  const claim = async (kind: "USDC" | "SOL") => {
    setClaiming(kind);
    try {
      const { txSig } = await api<{ txSig: string }>("/api/faucet", { body: { kind } });
      toast.success(kind === "USDC" ? "+$100 test USDC" : "+0.05 SOL for fees", {
        action: { label: "View", onClick: () => window.open(explorerTx(txSig), "_blank") },
      });
      await qc.invalidateQueries({ queryKey: ["balances"] });
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setClaiming(null);
    }
  };

  const signOut = async () => {
    await logout(() => qc.clear(), disconnect);
    router.replace("/");
  };

  const net = stats.data ? BigInt(stats.data.record.net) : 0n;

  return (
    <>
      <PageHeader title="Profile" />
      <div className="md:grid md:grid-cols-2 md:gap-10">
      <div>
      <div className="flex items-center gap-4">
        <UserAvatar seed={me.avatarSeed} name={me.displayName ?? me.username} size={72} />
        <div className="min-w-0">
          <p className="truncate text-2xl font-black">{me.displayName ?? me.username}</p>
          <p className="text-muted-foreground">@{me.username}</p>
          <button
            className="mt-1 flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              void navigator.clipboard.writeText(me.wallet);
              toast.success("Wallet address copied");
            }}
          >
            {shortAddress(me.wallet, 6)} <Copy className="size-3" />
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-3xl bg-card p-5">
        <p className="text-sm text-muted-foreground">Balance</p>
        {balances.isLoading ? (
          <Skeleton className="mt-1 h-10 w-32" />
        ) : (
          <p className="tabular text-4xl font-black">{formatUsd(balances.data?.usdc ?? 0n)}</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          test USDC · {((balances.data?.lamports ?? 0) / 1e9).toFixed(3)} SOL for fees
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button className="h-11 font-bold" onClick={() => claim("USDC")} disabled={!!claiming}>
            {claiming === "USDC" ? <Loader2 className="animate-spin" /> : "💵"} Get $100
          </Button>
          <Button variant="secondary" className="h-11" onClick={() => claim("SOL")} disabled={!!claiming}>
            {claiming === "SOL" ? <Loader2 className="animate-spin" /> : <Fuel />} Top up SOL
          </Button>
        </div>
      </div>

      <SectionTitle>Your record</SectionTitle>
      <div className="grid grid-cols-3 gap-2">
        {[
          ["Wins", stats.data?.record.wins ?? "–"],
          ["Losses", stats.data?.record.losses ?? "–"],
          [
            "Net",
            stats.data ? (
              <span className={cn(net > 0n && "text-yes", net < 0n && "text-no")}>{formatUsd(net, { sign: true })}</span>
            ) : (
              "–"
            ),
          ],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-2xl bg-card p-3 text-center">
            <p className="tabular text-xl font-black">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {!!stats.data?.vsFriends.length && (
        <>
          <SectionTitle>Head to head</SectionTitle>
          <div className="space-y-2">
            {stats.data.vsFriends.map(({ user, record }) => (
              <div key={user.id} className="flex items-center gap-3 rounded-2xl bg-card p-3">
                <UserAvatar seed={user.avatarSeed} name={user.displayName ?? user.username} size={32} />
                <span className="flex-1 font-semibold">vs @{user.username}</span>
                <span className="tabular font-bold">
                  {record.wins}-{record.losses}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      </div>

      <div className="md:[&>div:first-child]:mt-0">
      <SectionTitle>History</SectionTitle>
      <Button asChild variant="secondary" className="h-11 w-full">
        <Link href="/home?tab=settled">See settled bets</Link>
      </Button>

      <SectionTitle>Settings</SectionTitle>
      <div className="space-y-2">
        <Button
          variant="secondary"
          className="h-11 w-full justify-start"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          {resolvedTheme === "dark" ? <Sun /> : <Moon />}
          {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
        </Button>
        <Button asChild variant="secondary" className="h-11 w-full justify-start">
          <a href={explorerAddress(me.wallet)} target="_blank" rel="noreferrer">
            <ExternalLink /> View wallet on Solana
          </a>
        </Button>
        {isBurner && (
          <>
            <Button
              variant="secondary"
              className="h-11 w-full justify-start"
              onClick={async () => {
                const link = activeBurnerLoginLink();
                if (!link) return;
                await navigator.clipboard.writeText(link);
                toast.success("Login link copied", {
                  description: "Open it on any browser to get back into this account. Keep it private — it works like a password.",
                  duration: 8000,
                });
              }}
            >
              <KeyRound /> Copy login link
            </Button>
            <Button variant="secondary" className="h-11 w-full justify-start" onClick={signOut}>
              <Users /> Switch account
            </Button>
            <Button
              variant="secondary"
              className="h-11 w-full justify-start"
              onClick={async () => {
                if (!confirm("Start a brand-new burner account? This one stays saved on this device — switch back to it from the sign-in page.")) return;
                resetBurner();
                await signOut();
              }}
            >
              <RefreshCw /> New burner account
            </Button>
          </>
        )}
        <Button variant="ghost" className="h-11 w-full justify-start text-destructive" onClick={signOut}>
          <LogOut /> Sign out
        </Button>
      </div>
      </div>
      </div>
    </>
  );
}
