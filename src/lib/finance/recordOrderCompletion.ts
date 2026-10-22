import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient;

export async function recordOrderCompletion(
  storeId: string,
  order: { id: string; totalCents: number },
  client: PrismaClientOrTx = prisma,
) {
  const existing = await client.financeEntry.findFirst({ where: { storeId, orderId: order.id } });
  if (existing) return existing;

  return client.financeEntry.create({
    data: {
      storeId,
      orderId: order.id,
      kind: "INCOME",
      amountCents: order.totalCents,
      paidAt: new Date(),
      description: `Pedido ${order.id}`,
    },
  });
}
