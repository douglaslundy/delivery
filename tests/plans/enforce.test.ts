import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { assertFeature, assertWithinPlan, PlanLimitError } from "@/lib/plans/enforce";

describe("plan enforcement", () => {
  let planId: string;
  let limitedStoreId: string;
  let freeStoreId: string;

  beforeAll(async () => {
    const plan = await prisma.plan.create({
      data: {
        name: "Teste enforce",
        priceCents: 100,
        maxProducts: 1,
        maxCategories: null,
        features: { finance: true, marketing: false },
      },
    });
    planId = plan.id;
    limitedStoreId = (await prisma.store.create({ data: { slug: "plano-limitado", name: "Limitada", planId } })).id;
    freeStoreId = (await prisma.store.create({ data: { slug: "sem-plano", name: "Sem plano" } })).id;
  });
  afterAll(async () => {
    await prisma.store.deleteMany({ where: { id: { in: [limitedStoreId, freeStoreId] } } });
    await prisma.plan.delete({ where: { id: planId } });
  });

  it("allows creation under the limit and blocks at the limit", async () => {
    await expect(assertWithinPlan(limitedStoreId, "products")).resolves.toBeUndefined();
    await prisma.product.create({ data: { storeId: limitedStoreId, name: "P1", priceCents: 100 } });
    await expect(assertWithinPlan(limitedStoreId, "products")).rejects.toBeInstanceOf(PlanLimitError);
    await expect(assertWithinPlan(limitedStoreId, "products")).rejects.toThrow(/Limite do plano atingido/);
  });

  it("treats a null limit as unlimited", async () => {
    await prisma.category.createMany({ data: [{ storeId: limitedStoreId, name: "A" }, { storeId: limitedStoreId, name: "B" }] });
    await expect(assertWithinPlan(limitedStoreId, "categories")).resolves.toBeUndefined();
  });

  it("gates features by the plan flags", async () => {
    await expect(assertFeature(limitedStoreId, "finance")).resolves.toBeUndefined();
    await expect(assertFeature(limitedStoreId, "marketing")).rejects.toBeInstanceOf(PlanLimitError);
    await expect(assertFeature(limitedStoreId, "pdv")).rejects.toThrow(/indisponível/);
  });

  it("applies no limits to a store without a plan", async () => {
    await expect(assertWithinPlan(freeStoreId, "orders")).resolves.toBeUndefined();
    await expect(assertFeature(freeStoreId, "fiscal")).resolves.toBeUndefined();
  });

  it("counts orders only from the current month", async () => {
    const plan = await prisma.plan.update({ where: { id: planId }, data: { maxOrdersPerMonth: 1 } });
    expect(plan.maxOrdersPerMonth).toBe(1);
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 2);
    await prisma.order.create({
      data: { storeId: limitedStoreId, channel: "PDV", subtotalCents: 100, totalCents: 100, createdAt: lastMonth },
    });
    await expect(assertWithinPlan(limitedStoreId, "orders")).resolves.toBeUndefined();
    await prisma.order.create({ data: { storeId: limitedStoreId, channel: "PDV", subtotalCents: 100, totalCents: 100 } });
    await expect(assertWithinPlan(limitedStoreId, "orders")).rejects.toBeInstanceOf(PlanLimitError);
  });
});
