// Relative imports only: also used by scripts/ (resolver).
import { prisma } from "../db";

export async function notify(userId: string, type: string, message: string, betId?: string) {
  await prisma.notification.create({ data: { userId, type, message, betId } });
}
