import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { FEATURE_LABEL, RESOURCE_LABEL, type PlanFeature, type PlanResource } from "@/lib/plans/labels";

export type { PlanResource, PlanFeature };

const LIMIT_FIELD = {
  orders: "maxOrdersPerMonth",
  products: "maxProducts",
  customers: "maxCustomers",
  categories: "maxCategories",
  members: "maxMembers",
  deliveryPeople: "maxDeliveryPeople",
} as const;

export class PlanLimitError extends Error {}

export function startOfMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export async function countUsage(storeId: string, resource: PlanResource): Promise<number> {
  switch (resource) {
    case "orders":
      return prisma.order.count({ where: { storeId, createdAt: { gte: startOfMonth() } } });
    case "products":
      return prisma.product.count({ where: { storeId } });
    case "customers":
      return prisma.customer.count({ where: { storeId } });
    case "categories":
      return prisma.category.count({ where: { storeId } });
    case "members":
      return prisma.storeMember.count({ where: { storeId } });
    case "deliveryPeople":
      return prisma.deliveryPerson.count({ where: { storeId } });
  }
}

async function planOf(storeId: string) {
  const store = await prisma.store.findUnique({ where: { id: storeId }, include: { plan: true } });
  return store?.plan ?? null;
}

// Loja sem plano ou limite null = ilimitado.
export async function assertWithinPlan(storeId: string, resource: PlanResource): Promise<void> {
  const plan = await planOf(storeId);
  const limit = plan?.[LIMIT_FIELD[resource]];
  if (limit == null) return;
  if ((await countUsage(storeId, resource)) >= limit) {
    throw new PlanLimitError(`Limite do plano atingido: ${limit} ${RESOURCE_LABEL[resource]} (plano ${plan!.name})`);
  }
}

export async function assertFeature(storeId: string, feature: PlanFeature): Promise<void> {
  const plan = await planOf(storeId);
  if (!plan) return;
  const features = (plan.features ?? {}) as Prisma.JsonObject;
  if (features[feature] !== true) {
    throw new PlanLimitError(`Recurso indisponível no plano ${plan.name}: ${FEATURE_LABEL[feature]}`);
  }
}

// Converte PlanLimitError em 403 para as rotas; outros erros sobem.
export async function planGuard(check: () => Promise<void>): Promise<NextResponse | null> {
  try {
    await check();
    return null;
  } catch (error) {
    if (error instanceof PlanLimitError) return NextResponse.json({ error: error.message }, { status: 403 });
    throw error;
  }
}
