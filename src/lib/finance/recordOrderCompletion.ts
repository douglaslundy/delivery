import { prisma } from "@/lib/prisma";

export async function recordOrderCompletion(storeId: string, order: { id: string; totalCents: number }) {
  const existing = await prisma.financeEntry.findFirst({ where: { storeId, orderId: order.id } });
  if (existing) return existing;

  return prisma.financeEntry.create({
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
