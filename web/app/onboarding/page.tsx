"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/user-avatar";
import { useMe, type Me } from "@/hooks/use-session";
import { api } from "@/lib/api-client";
import { friendlyError } from "@/lib/errors";

function Onboarding() {
  const { data: me, isFetched } = useMe();
  const router = useRouter();
  const next = useSearchParams().get("next");
  const qc = useQueryClient();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isFetched && !me) router.replace("/");
    if (me?.username) router.replace(next ?? "/home");
  }, [me, isFetched, next, router]);

  const clean = username.toLowerCase().replace(/[^a-z0-9_]/g, "");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { user } = await api<{ user: Me }>("/api/users/username", {
        body: { username: clean, displayName: displayName.trim() || undefined },
      });
      qc.setQueryData(["me"], user);
      router.replace(next ?? "/home");
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-16 pb-10">
      <div className="flex items-center gap-4">
        <UserAvatar seed={me?.avatarSeed ?? "new"} name={displayName || clean || "?"} size={64} />
        <div>
          <h1 className="text-3xl font-black tracking-tight">Who are you?</h1>
          <p className="text-muted-foreground">Friends find you by your username.</p>
        </div>
      </div>
      <form onSubmit={submit} className="mt-10 flex flex-1 flex-col gap-6">
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <div className="relative">
            <span className="absolute top-1/2 left-4 -translate-y-1/2 text-muted-foreground">@</span>
            <Input
              id="username"
              autoFocus
              autoCapitalize="none"
              autoComplete="off"
              placeholder="justin"
              className="h-14 pl-9 text-lg"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={20}
            />
          </div>
          <p className="text-xs text-muted-foreground">3–20 letters, numbers or underscores.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="displayName">Display name (optional)</Label>
          <Input
            id="displayName"
            placeholder="Justin"
            className="h-14 text-lg"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={40}
          />
        </div>
        <Button
          type="submit"
          size="lg"
          className="mt-auto h-14 text-base font-bold"
          disabled={saving || clean.length < 3}
        >
          {saving && <Loader2 className="animate-spin" />}
          Let&apos;s go
        </Button>
      </form>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Onboarding />
    </Suspense>
  );
}
