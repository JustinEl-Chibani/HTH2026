// Relative imports only: also used by scripts/ (resolver).
import type { Prisma } from "@prisma/client";
import { prisma } from "../db";

export async function notify(
  userId: string,
  type: string,
  message: string,
  betId?: string,
  tx: Prisma.TransactionClient = prisma,
) {
  await tx.notification.create({ data: { userId, type, message, betId } });
}
