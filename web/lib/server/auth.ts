import "server-only";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import type { User } from "@prisma/client";
import { prisma } from "../db";
import { serverEnv } from "./env";
import { unauthorized } from "./api";

export const SESSION_COOKIE = "pym_session";
const SESSION_DAYS = 7;

const secret = () => new TextEncoder().encode(serverEnv().JWT_SECRET);

export async function createSessionToken(user: Pick<User, "id" | "wallet">): Promise<string> {
  return new SignJWT({ wallet: user.wallet })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
}

export async function setSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** The signed-in user, or null. */
export async function getSessionUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    return await prisma.user.findUnique({ where: { id: payload.sub } });
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) throw unauthorized();
  return user;
}

/** Signed in AND finished onboarding (has a username). */
export async function requireMember(): Promise<User & { username: string }> {
  const user = await requireUser();
  if (!user.username) throw unauthorized("Pick a username first");
  return user as User & { username: string };
}
