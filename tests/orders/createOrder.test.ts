import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createOrder } from "@/lib/orders/createOrder";

describe("createOrder", () => {
  let storeId: string, productId: string;
  beforeEach(async () => {
    storeId = (await prisma.store.create({ data: { slug: "create-order-teste", name: "T" } })).id;
    productId = (await prisma.product.create({ data: { storeId, name: "Suco", priceCents: 800 } })).id;
  });
  afterEach(async () => { await prisma.store.delete({ where: { id: storeId } }); });

  it("creates a PDV order and recalculates price from the menu, ignoring a tampered client price", async () => {
    const order = await createOrder(storeId, {
      channel: "PDV",
      items: [{ productId, quantity: 2, selectedAddonIds: [], clientSentPriceCents: 1 } as any],
    });
    expect(order.totalCents).toBe(1600);
  });

  it("rejects a SALAO order without tableNumber", async () => {
    await expect(createOrder(storeId, { channel: "SALAO", items: [{ productId, quantity: 1, selectedAddonIds: [] }] } as any))
      .rejects.toThrow();
  });

  it("writes an initial OrderStatusEvent", async () => {
    const order = await createOrder(storeId, { channel: "PDV", items: [{ productId, quantity: 1, selectedAddonIds: [] }] });
    const events = await prisma.orderStatusEvent.findMany({ where: { orderId: order.id } });
    expect(events).toHaveLength(1);
    expect(events[0].status).toBe("RECEIVED");
  });
});
