"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Search, Swords, UserPlus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState, PageHeader, SectionTitle } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import type { Me } from "@/hooks/use-session";
import { api } from "@/lib/api-client";
import { friendlyError } from "@/lib/errors";
import { formatUsd } from "@/lib/money";
import { cn } from "@/lib/utils";

interface FriendRow {
  friendshipId: string;
  user: Me;
  record: { wins: number; losses: number; net: string };
}
interface FriendsResponse {
  friends: FriendRow[];
  incoming: { friendshipId: string; user: Me }[];
  outgoing: { friendshipId: string; user: Me }[];
}

function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function PersonRow({ user, children, sub }: { user: Me; children?: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card p-3">
      <UserAvatar seed={user.avatarSeed} name={user.displayName ?? user.username} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{user.displayName ?? user.username}</p>
        <p className="truncate text-sm text-muted-foreground">{sub ?? `@${user.username}`}</p>
      </div>
      {children}
    </div>
  );
}

export default function FriendsPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim().toLowerCase().replace(/^@/, ""));

  const { data, isLoading } = useQuery({
    queryKey: ["friends"],
    queryFn: () => api<FriendsResponse>("/api/friends"),
    refetchInterval: 10_000,
  });
  const search = useQuery({
    queryKey: ["user-search", dq],
    enabled: dq.length > 0,
    queryFn: () => api<{ users: Me[] }>(`/api/users/search?q=${encodeURIComponent(dq)}`).then((r) => r.users),
  });

  const add = useMutation({
    mutationFn: (username: string) => api<{ status: string }>("/api/friends", { body: { username } }),
    onSuccess: (r, username) => {
      toast.success(r.status === "ACCEPTED" ? `You and @${username} are friends!` : `Request sent to @${username}`);
      qc.invalidateQueries({ queryKey: ["friends"] });
    },
    onError: (e) => toast.error(friendlyError(e)),
  });
  const accept = useMutation({
    mutationFn: (id: string) => api(`/api/friends/${id}/accept`, { body: {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["friends"] }),
    onError: (e) => toast.error(friendlyError(e)),
  });

  const known = new Set([
    ...(data?.friends.map((f) => f.user.id) ?? []),
    ...(data?.outgoing.map((f) => f.user.id) ?? []),
  ]);

  return (
    <>
      <PageHeader title="Friends" subtitle="The people you'll take money from." />
      <div className="relative md:max-w-md">
        <Search className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Find by username"
          className="h-12 rounded-2xl pl-11"
          autoCapitalize="none"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {dq && (
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3">
          {search.isLoading && <Skeleton className="h-16 rounded-2xl" />}
          {search.data?.length === 0 && (
            <p className="px-1 text-sm text-muted-foreground">No one called &ldquo;{dq}&rdquo; yet.</p>
          )}
          {search.data?.map((u) => (
            <PersonRow key={u.id} user={u}>
              {known.has(u.id) ? (
                <span className="text-sm text-muted-foreground">
                  {data?.friends.some((f) => f.user.id === u.id) ? "Friends" : "Requested"}
                </span>
              ) : (
                <Button size="sm" onClick={() => add.mutate(u.username!)} disabled={add.isPending}>
                  <UserPlus /> Add
                </Button>
              )}
            </PersonRow>
          ))}
        </div>
      )}

      {!!data?.incoming.length && (
        <>
          <SectionTitle>Requests</SectionTitle>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3">
            {data.incoming.map((r) => (
              <PersonRow key={r.friendshipId} user={r.user} sub="wants to be friends">
                <Button size="sm" onClick={() => accept.mutate(r.friendshipId)} disabled={accept.isPending}>
                  {accept.isPending ? <Loader2 className="animate-spin" /> : <Check />} Accept
                </Button>
              </PersonRow>
            ))}
          </div>
        </>
      )}

      <SectionTitle>Your crew</SectionTitle>
      {isLoading ? (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3">
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-16 rounded-2xl" />
        </div>
      ) : data?.friends.length ? (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3">
          {data.friends.map((f) => {
            const net = BigInt(f.record.net);
            const played = f.record.wins + f.record.losses;
            return (
              <PersonRow
                key={f.friendshipId}
                user={f.user}
                sub={
                  played ? (
                    <span>
                      You&apos;re {f.record.wins}-{f.record.losses} ·{" "}
                      <span className={cn(net > 0n && "text-yes", net < 0n && "text-no")}>
                        {formatUsd(net, { sign: true })}
                      </span>
                    </span>
                  ) : (
                    `@${f.user.username} · no bets yet`
                  )
                }
              >
                <Button asChild size="sm" variant="secondary">
                  <Link href={`/new?opponent=${f.user.username}`}>
                    <Swords /> Challenge
                  </Link>
                </Button>
              </PersonRow>
            );
          })}
        </div>
      ) : (
        <EmptyState icon="👯" title="No friends yet">
          Search for a username above to add someone.
        </EmptyState>
      )}

      {!!data?.outgoing.length && (
        <>
          <SectionTitle>Pending</SectionTitle>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3">
            {data.outgoing.map((r) => (
              <PersonRow key={r.friendshipId} user={r.user} sub="request sent" />
            ))}
          </div>
        </>
      )}
    </>
  );
}
