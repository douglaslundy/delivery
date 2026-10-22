import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { assignDelivery } from "@/lib/delivery/assignDelivery";

describe("assignDelivery", () => {
  let storeA: string, storeB: string, orderId: string, deliveryPersonBId: string;
  beforeEach(async () => {
    storeA = (await prisma.store.create({ data: { slug: "deliv-a", name: "A" } })).id;
    storeB = (await prisma.store.create({ data: { slug: "deliv-b", name: "B" } })).id;
    orderId = (await prisma.order.create({ data: { storeId: storeA, channel: "DELIVERY", subtotalCents: 100, totalCents: 100 } })).id;
    deliveryPersonBId = (await prisma.deliveryPerson.create({ data: { storeId: storeB, name: "Joao", phone: "11999999999" } })).id;
  });
  afterEach(async () => { await prisma.store.deleteMany({ where: { id: { in: [storeA, storeB] } } }); });

  it("rejects assigning a delivery person from another store", async () => {
    await expect(assignDelivery(storeA, orderId, deliveryPersonBId)).rejects.toThrow();
  });
});
