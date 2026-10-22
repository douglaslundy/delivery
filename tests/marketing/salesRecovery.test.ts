import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { findInactiveCustomers } from "@/lib/marketing/salesRecovery";

describe("findInactiveCustomers", () => {
  let storeId: string;
  beforeEach(async () => { storeId = (await prisma.store.create({ data: { slug: "recovery-teste", name: "T" } })).id; });
  afterEach(async () => { await prisma.store.delete({ where: { id: storeId } }); });

  it("finds a customer whose last order was more than N days ago", async () => {
    const old = new Date(Date.now() - 40 * 86400000);
    await prisma.order.create({ data: { storeId, customerId: "c1", channel: "PDV", subtotalCents: 1, totalCents: 1, createdAt: old } });
    const result = await findInactiveCustomers(storeId, 30);
    expect(result.map(r => r.customerId)).toContain("c1");
  });
});
