import { prisma } from "@/lib/prisma";

export async function findInactiveCustomers(
  storeId: string,
  daysSinceLastOrder: number,
): Promise<{ customerId: string; lastOrderAt: Date }[]> {
  const grouped = await prisma.order.groupBy({
    by: ["customerId"],
    where: { storeId, customerId: { not: null } },
    _max: { createdAt: true },
  });

  const cutoff = new Date(Date.now() - daysSinceLastOrder * 86400000);

  return grouped
    .filter((g) => g._max.createdAt !== null && g._max.createdAt < cutoff)
    .map((g) => ({ customerId: g.customerId as string, lastOrderAt: g._max.createdAt as Date }));
}
