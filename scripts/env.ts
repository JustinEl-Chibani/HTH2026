import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Load web/.env.local (+ web/.env) so scripts share the app's configuration. */
export function loadEnv() {
  dotenv.config({ path: path.join(REPO_ROOT, "web", ".env.local"), quiet: true });
  dotenv.config({ path: path.join(REPO_ROOT, "web", ".env"), quiet: true });
  // Prisma resolves relative sqlite paths against the schema dir; make that explicit for scripts.
  if (process.env.DATABASE_URL?.startsWith("file:./")) {
    process.env.DATABASE_URL = `file:${path.join(REPO_ROOT, "web", "prisma", process.env.DATABASE_URL.slice(7)).replace(/\\/g, "/")}`;
  }
}

export function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

// Side effect: load env as soon as any script imports this module (before web/lib reads it).
loadEnv();
