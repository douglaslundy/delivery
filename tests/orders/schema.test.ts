import { prisma } from "@/lib/prisma";
import { describe, it, expect } from "vitest";

describe("order schema", () => {
  it("creates an order with an initial status event", async () => {
    const store = await prisma.store.create({ data: { slug: "order-schema-teste", name: "T" } });
    const order = await prisma.order.create({
      data: { storeId: store.id, channel: "PDV", subtotalCents: 1000, totalCents: 1000 },
    });
    expect(order.status).toBe("RECEIVED");
    await prisma.store.delete({ where: { id: store.id } });
  });
});
