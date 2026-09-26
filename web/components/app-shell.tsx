"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { Bell, Home, Loader2, Plus, User, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { ConnectWallet } from "@/components/connect-wallet";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useSession } from "@/components/session-provider";
import { useMe } from "@/hooks/use-session";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/new", label: "New bet", icon: Plus, center: true },
  { href: "/activity", label: "Activity", icon: Bell },
  { href: "/profile", label: "Profile", icon: User },
];

function useUnreadCount(enabled: boolean) {
  return useQuery({
    queryKey: ["notifications", "unread"],
    enabled,
    refetchInterval: 5_000,
    queryFn: () => api<{ unread: number }>("/api/notifications?countOnly=1").then((r) => r.unread),
  });
}

function WalletBanner() {
  const { connected, publicKey, connecting } = useWallet();
  const { data: me } = useMe();
  const { needsSignIn, signIn, signingIn } = useSession();
  if (!me || connecting) return null;
  if (connected && publicKey && needsSignIn) {
    return (
      <div className="mx-4 mt-3 flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
        <span className="flex-1">
          Your wallet switched accounts. Sign in again to act as this wallet.
        </span>
        <Button size="sm" onClick={signIn} disabled={signingIn}>
          {signingIn && <Loader2 className="animate-spin" />} Sign in
        </Button>
      </div>
    );
  }
  if (!connected) {
    return (
      <div className="mx-4 mt-3 flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-sm">
        <span className="flex-1 text-muted-foreground">Wallet disconnected — reconnect to make moves.</span>
        <Sheet>
          <SheetTrigger asChild>
            <Button size="sm" variant="secondary">
              Reconnect
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="mx-auto max-w-md rounded-t-3xl p-6">
            <SheetHeader className="p-0 pb-4">
              <SheetTitle>Reconnect your wallet</SheetTitle>
            </SheetHeader>
            <ConnectWallet />
          </SheetContent>
        </Sheet>
      </div>
    );
  }
  return null;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { data: me, isFetched } = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const { data: unread } = useUnreadCount(!!me?.username);

  useEffect(() => {
    if (!isFetched) return;
    if (!me) router.replace(`/?next=${encodeURIComponent(pathname)}`);
    else if (!me.username) router.replace(`/onboarding?next=${encodeURIComponent(pathname)}`);
  }, [me, isFetched, pathname, router]);

  if (!me?.username) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <WalletBanner />
      <main className="flex-1 px-4 pt-4 pb-28">{children}</main>
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto grid max-w-md grid-cols-5 items-end px-2 pt-2">
          {TABS.map(({ href, label, icon: Icon, center }) => {
            const active = pathname === href || (href !== "/home" && pathname.startsWith(href));
            if (center) {
              return (
                <Link key={href} href={href} className="flex flex-col items-center" aria-label={label}>
                  <span
                    className={cn(
                      "-mt-7 grid size-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_30px_rgba(182,240,60,.35)] ring-4 ring-background transition-transform active:scale-95",
                      active && "scale-105",
                    )}
                  >
                    <Icon className="size-8" strokeWidth={3} />
                  </span>
                  <span className="mt-1 text-[11px] font-semibold">Bet</span>
                </Link>
              );
            }
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative flex flex-col items-center gap-1 py-1 text-[11px] font-medium text-muted-foreground transition-colors",
                  active && "text-foreground",
                )}
              >
                <Icon className={cn("size-6", active && "text-brand-ink")} strokeWidth={active ? 2.5 : 2} />
                {label}
                {href === "/activity" && !!unread && (
                  <span className="absolute top-0 right-[calc(50%-18px)] grid min-w-4 place-items-center rounded-full bg-no px-1 text-[10px] font-bold text-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
