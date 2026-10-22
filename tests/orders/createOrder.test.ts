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

  it("applies a coupon discount and decrements its usage limit", async () => {
    const coupon = await prisma.coupon.create({ data: { storeId, code: "APLICA", kind: "FIXED", value: 200, usageLimit: 1 } });
    const order = await createOrder(storeId, { channel: "PDV", items: [{ productId, quantity: 1, selectedAddonIds: [] }], couponCode: "APLICA" } as any);
    expect(order.discountCents).toBe(200);
    const updated = await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } });
    expect(updated.usageLimit).toBe(0);
  });

  it("never lets two concurrent orders both use a coupon with usageLimit 1", async () => {
    await prisma.coupon.create({ data: { storeId, code: "CORRIDA", kind: "FIXED", value: 200, usageLimit: 1 } });

    const attempt = () => createOrder(storeId, { channel: "PDV", items: [{ productId, quantity: 1, selectedAddonIds: [] }], couponCode: "CORRIDA" } as any);
    const results = await Promise.allSettled([attempt(), attempt()]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    expect(fulfilled).toHaveLength(1);

    const coupon = await prisma.coupon.findFirstOrThrow({ where: { storeId, code: "CORRIDA" } });
    expect(coupon.usageLimit).toBe(0);
  });

  it("rejects an order with an exhausted coupon and creates no order at all", async () => {
    await prisma.coupon.create({ data: { storeId, code: "ESGOTADO", kind: "FIXED", value: 200, usageLimit: 0 } });
    await expect(
      createOrder(storeId, { channel: "PDV", items: [{ productId, quantity: 1, selectedAddonIds: [] }], couponCode: "ESGOTADO" } as any),
    ).rejects.toThrow();
    const orders = await prisma.order.findMany({ where: { storeId } });
    expect(orders).toHaveLength(0);
  });
});
