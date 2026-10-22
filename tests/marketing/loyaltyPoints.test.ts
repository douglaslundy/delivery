import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { getLoyaltyPointsBalance, awardLoyaltyPointsForOrder } from "@/lib/marketing/loyaltyPoints";

describe("loyalty points accrual", () => {
  let storeId: string, orderId: string;
  beforeEach(async () => {
    storeId = (await prisma.store.create({ data: { slug: "loyalty-points-teste", name: "T" } })).id;
    const order = await prisma.order.create({
      data: { storeId, channel: "PDV", status: "COMPLETED", customerId: "cliente-1", subtotalCents: 2000, totalCents: 2000 },
    });
    orderId = order.id;
  });
  afterEach(async () => { await prisma.store.delete({ where: { id: storeId } }); });

  it("does nothing when the store has no loyalty program", async () => {
    await awardLoyaltyPointsForOrder(storeId, { id: orderId, totalCents: 2000, customerId: "cliente-1" });
    expect(await getLoyaltyPointsBalance(storeId, "cliente-1")).toBe(0);
  });

  it("does nothing when the loyalty program is inactive", async () => {
    await prisma.loyaltyProgram.create({ data: { storeId, pointsPerCurrencyUnit: 1, redemptionRuleCents: 1000, active: false } });
    await awardLoyaltyPointsForOrder(storeId, { id: orderId, totalCents: 2000, customerId: "cliente-1" });
    expect(await getLoyaltyPointsBalance(storeId, "cliente-1")).toBe(0);
  });

  it("does nothing when the order has no customerId", async () => {
    await prisma.loyaltyProgram.create({ data: { storeId, pointsPerCurrencyUnit: 1, redemptionRuleCents: 1000 } });
    await awardLoyaltyPointsForOrder(storeId, { id: orderId, totalCents: 2000, customerId: null });
    expect(await getLoyaltyPointsBalance(storeId, "cliente-1")).toBe(0);
  });

  it("awards pointsPerCurrencyUnit * (totalCents / 100) points", async () => {
    await prisma.loyaltyProgram.create({ data: { storeId, pointsPerCurrencyUnit: 2, redemptionRuleCents: 1000 } });
    await awardLoyaltyPointsForOrder(storeId, { id: orderId, totalCents: 2000, customerId: "cliente-1" });
    expect(await getLoyaltyPointsBalance(storeId, "cliente-1")).toBe(40);
  });

  it("is idempotent when called twice for the same order", async () => {
    await prisma.loyaltyProgram.create({ data: { storeId, pointsPerCurrencyUnit: 1, redemptionRuleCents: 1000 } });
    await awardLoyaltyPointsForOrder(storeId, { id: orderId, totalCents: 2000, customerId: "cliente-1" });
    await awardLoyaltyPointsForOrder(storeId, { id: orderId, totalCents: 2000, customerId: "cliente-1" });
    expect(await getLoyaltyPointsBalance(storeId, "cliente-1")).toBe(20);
  });

  it("participates in the caller's transaction (rollback undoes the entry)", async () => {
    await prisma.loyaltyProgram.create({ data: { storeId, pointsPerCurrencyUnit: 1, redemptionRuleCents: 1000 } });
    await prisma
      .$transaction(async (tx) => {
        await awardLoyaltyPointsForOrder(storeId, { id: orderId, totalCents: 2000, customerId: "cliente-1" }, tx);
        throw new Error("force rollback");
      })
      .catch(() => {});

    expect(await getLoyaltyPointsBalance(storeId, "cliente-1")).toBe(0);
  });
});
