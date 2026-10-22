import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { recordOrderCompletion } from "@/lib/finance/recordOrderCompletion";

describe("recordOrderCompletion", () => {
  let storeId: string, orderId: string;
  beforeEach(async () => {
    storeId = (await prisma.store.create({ data: { slug: "completion-teste", name: "T" } })).id;
    const order = await prisma.order.create({ data: { storeId, channel: "PDV", status: "COMPLETED", subtotalCents: 2000, totalCents: 2000 } });
    orderId = order.id;
  });
  afterEach(async () => { await prisma.store.delete({ where: { id: storeId } }); });

  it("creates one INCOME entry for the order", async () => {
    await recordOrderCompletion(storeId, { id: orderId, totalCents: 2000 } as any);
    const entries = await prisma.financeEntry.findMany({ where: { orderId } });
    expect(entries).toHaveLength(1);
    expect(entries[0].amountCents).toBe(2000);
  });

  it("is idempotent when called twice for the same order", async () => {
    await recordOrderCompletion(storeId, { id: orderId, totalCents: 2000 } as any);
    await recordOrderCompletion(storeId, { id: orderId, totalCents: 2000 } as any);
    const entries = await prisma.financeEntry.findMany({ where: { orderId } });
    expect(entries).toHaveLength(1);
  });
});
