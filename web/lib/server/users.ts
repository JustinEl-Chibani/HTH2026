import "server-only";
import type { User } from "@prisma/client";
import { prisma } from "../db";

export interface PublicUser {
  id: string;
  wallet: string;
  username: string | null;
  displayName: string | null;
  avatarSeed: string;
}

export function publicUser(u: User): PublicUser {
  return {
    id: u.id,
    wallet: u.wallet,
    username: u.username,
    displayName: u.displayName,
    avatarSeed: u.avatarSeed,
  };
}

/** Accepted friends of a user (either direction). */
export async function friendsOf(userId: string): Promise<User[]> {
  const rows = await prisma.friendship.findMany({
    where: { status: "ACCEPTED", OR: [{ requesterId: userId }, { addresseeId: userId }] },
    include: { requester: true, addressee: true },
  });
  return rows.map((r) => (r.requesterId === userId ? r.addressee : r.requester));
}

export async function areFriends(a: string, b: string): Promise<boolean> {
  const row = await prisma.friendship.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { requesterId: a, addresseeId: b },
        { requesterId: b, addresseeId: a },
      ],
    },
  });
  return !!row;
}
