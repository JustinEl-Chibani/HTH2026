"use client";

import { ChevronRight, KeyRound, Loader2, Plus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/user-avatar";
import {
  activateSavedBurner,
  forgetSavedBurner,
  importBurnerSecret,
  keyFromLoginInput,
  listSavedBurners,
  resetBurner,
  type SavedBurnerAccount,
} from "@/lib/burner";
import { shortAddress, timeAgo } from "@/lib/format";
import { reloginAsActiveBurner } from "@/lib/relogin";

export function useSavedBurners() {
  const [accounts, setAccounts] = useState<SavedBurnerAccount[]>([]);
  const refresh = useCallback(() => setAccounts(listSavedBurners()), []);
  useEffect(refresh, [refresh]);
  return { accounts, refresh };
}

/** "Welcome back" list of burner accounts used in this browser, plus login-link entry. */
export function SavedAccounts({
  accounts,
  refresh,
  next,
}: {
  accounts: SavedBurnerAccount[];
  refresh: () => void;
  next?: string | null;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [showLink, setShowLink] = useState(false);
  const [link, setLink] = useState("");

  const continueAs = async (wallet: string) => {
    setBusy(wallet);
    if (activateSavedBurner(wallet)) await reloginAsActiveBurner(next);
    else setBusy(null);
  };

  const loginWithLink = async () => {
    const key = keyFromLoginInput(link);
    if (!key || !importBurnerSecret(key)) {
      toast.error("That doesn't look like a PutYourMoney login link.");
      return;
    }
    setBusy("link");
    await reloginAsActiveBurner(next);
  };

  const newAccount = async () => {
    setBusy("new");
    resetBurner();
    await reloginAsActiveBurner(next);
  };

  return (
    <div className="space-y-3">
      {accounts.length > 0 && (
        <>
          <p className="text-sm font-semibold text-muted-foreground">Welcome back</p>
          <div className="space-y-2">
            {accounts.map((a) => (
              <div key={a.wallet} className="group flex items-center gap-2">
                <button
                  onClick={() => continueAs(a.wallet)}
                  disabled={!!busy}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-muted/60 p-3 text-left transition-colors hover:bg-muted disabled:opacity-60"
                >
                  <UserAvatar seed={a.wallet} name={a.label ?? "?"} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">
                      {a.label ? `Continue as ${a.label}` : "Continue"}
                    </span>
                    <span className="block truncate font-mono text-xs text-muted-foreground">
                      {shortAddress(a.wallet, 5)} · {timeAgo(new Date(a.lastUsed))}
                    </span>
                  </span>
                  {busy === a.wallet ? <Loader2 className="size-4 animate-spin" /> : <ChevronRight className="size-4 text-muted-foreground" />}
                </button>
                <button
                  aria-label="Forget this account on this device"
                  title="Forget on this device"
                  className="grid size-8 place-items-center rounded-full text-muted-foreground opacity-60 hover:bg-muted hover:opacity-100"
                  onClick={() => {
                    if (!confirm("Forget this account on this device? You'll need its login link to get back in.")) return;
                    forgetSavedBurner(a.wallet);
                    refresh();
                  }}
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
          </div>
          <Button variant="secondary" className="h-11 w-full" onClick={newAccount} disabled={!!busy}>
            {busy === "new" ? <Loader2 className="animate-spin" /> : <Plus />} New burner account
          </Button>
        </>
      )}

      {showLink ? (
        <div className="flex gap-2">
          <Input
            autoFocus
            placeholder="Paste your login link"
            className="h-11 rounded-xl"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void loginWithLink()}
          />
          <Button className="h-11" onClick={loginWithLink} disabled={!link.trim() || !!busy}>
            {busy === "link" ? <Loader2 className="animate-spin" /> : "Log in"}
          </Button>
        </div>
      ) : (
        <button
          className="flex w-full items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          onClick={() => setShowLink(true)}
        >
          <KeyRound className="size-4" /> Have a login link?
        </button>
      )}
    </div>
  );
}
