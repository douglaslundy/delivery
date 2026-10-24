import { prisma } from "@/lib/prisma";
import { countUsage } from "@/lib/plans/enforce";
import type { PlanFeature, PlanResource } from "@/lib/plans/labels";

const FIELD = {
  orders: "maxOrdersPerMonth",
  products: "maxProducts",
  customers: "maxCustomers",
  categories: "maxCategories",
  members: "maxMembers",
  deliveryPeople: "maxDeliveryPeople",
} as const;

export const RESOURCES = Object.keys(FIELD) as PlanResource[];

// plan null = loja sem plano: tudo liberado.
export async function getPlanUsage(storeId: string) {
  const store = await prisma.store.findUnique({ where: { id: storeId }, include: { plan: true } });
  const plan = store?.plan ?? null;
  const features = (plan?.features ?? {}) as Partial<Record<PlanFeature, boolean>>;
  const usage = await Promise.all(
    RESOURCES.map(async (resource) => ({
      resource,
      used: await countUsage(storeId, resource),
      limit: plan ? plan[FIELD[resource]] : null,
    })),
  );
  return { planName: plan?.name ?? null, hasPlan: plan !== null, features, usage };
}

export const featureEnabled = (u: { hasPlan: boolean; features: Partial<Record<PlanFeature, boolean>> }, f: PlanFeature) =>
  !u.hasPlan || u.features[f] === true;
