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

  it("rejects quantity > 1 for a per-kg product instead of silently rounding the unit price", async () => {
    const perKgId = (await prisma.product.create({ data: { storeId, name: "Feijoada", priceCents: 1665, pricePerKg: true } })).id;
    await expect(
      createOrder(storeId, { channel: "PDV", items: [{ productId: perKgId, quantity: 2, weightGrams: 1000, selectedAddonIds: [] }] }),
    ).rejects.toThrow();
  });

  it("does not snapshot an inactive addon onto the order even if its id was sent", async () => {
    const addon = await prisma.productAddon.create({ data: { storeId, productId, groupName: "Extra", name: "Guardanapo", priceCents: 0, active: false } });
    const order = await createOrder(storeId, {
      channel: "PDV",
      items: [{ productId, quantity: 1, selectedAddonIds: [addon.id] }],
    });
    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    expect(item.addons).toEqual([]);
  });
});
