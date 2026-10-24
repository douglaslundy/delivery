import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { startOfMonth } from "@/lib/plans/enforce";

export const STATUSES = ["TRIAL", "ACTIVE", "SUSPENDED", "CANCELED"] as const;

// Suspensa/cancelada bloqueia a loja no middleware (resolveStoreBySubdomain exige active).
export const isActiveStatus = (status: string) => status === "ACTIVE" || status === "TRIAL";

export async function listStoresWithUsage() {
  const stores = await prisma.store.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      plan: { select: { id: true, name: true } },
      members: { where: { role: "OWNER" }, include: { account: { select: { email: true } } }, take: 1 },
      _count: { select: { products: true, customers: true } },
    },
  });
  const monthOrders = await prisma.order.groupBy({
    by: ["storeId"],
    where: { createdAt: { gte: startOfMonth() } },
    _count: { _all: true },
  });
  const byStore = new Map(monthOrders.map((o) => [o.storeId, o._count._all]));
  return stores.map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    foodCategory: s.foodCategory,
    active: s.active,
    subscriptionStatus: s.subscriptionStatus,
    plan: s.plan,
    ownerEmail: s.members[0]?.account.email ?? null,
    ordersThisMonth: byStore.get(s.id) ?? 0,
    products: s._count.products,
    customers: s._count.customers,
    createdAt: s.createdAt,
  }));
}

export async function resetOwnerPassword(storeId: string, password: string): Promise<boolean> {
  const owner = await prisma.storeMember.findFirst({ where: { storeId, role: "OWNER" } });
  if (!owner) return false;
  await prisma.account.update({ where: { id: owner.accountId }, data: { passwordHash: await bcrypt.hash(password, 10) } });
  return true;
}

// Cascades do schema apagam o resto; contas dos membros ficam (podem ter outras lojas).
export async function deleteStore(storeId: string): Promise<void> {
  await prisma.store.delete({ where: { id: storeId } });
}
