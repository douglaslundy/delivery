import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient;

export async function getLoyaltyPointsBalance(storeId: string, customerId: string): Promise<number> {
  const entries = await prisma.loyaltyPointsLedger.findMany({ where: { storeId, customerId } });
  return entries.reduce((sum, entry) => sum + entry.points, 0);
}

export async function awardLoyaltyPointsForOrder(
  storeId: string,
  order: { id: string; totalCents: number; customerId: string | null },
  client: PrismaClientOrTx = prisma,
): Promise<void> {
  if (!order.customerId) return;

  const program = await client.loyaltyProgram.findUnique({ where: { storeId } });
  if (!program || !program.active) return;

  const existing = await client.loyaltyPointsLedger.findFirst({ where: { storeId, orderId: order.id } });
  if (existing) return;

  const points = Math.floor((program.pointsPerCurrencyUnit * order.totalCents) / 100);
  if (points <= 0) return;

  await client.loyaltyPointsLedger.create({
    data: { storeId, customerId: order.customerId, orderId: order.id, points },
  });
}
