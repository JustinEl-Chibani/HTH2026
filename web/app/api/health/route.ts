import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liveness check for the host: the server is up and the database answers. */
export async function GET() {
  await prisma.$queryRaw`SELECT 1`;
  return Response.json({ ok: true });
}
