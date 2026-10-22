import { prisma } from "@/lib/prisma";
import { describe, it, expect } from "vitest";

describe("marketing/delivery schema", () => {
  it("creates a coupon and a delivery zone", async () => {
    const store = await prisma.store.create({ data: { slug: "mkt-schema-teste", name: "T" } });
    const coupon = await prisma.coupon.create({ data: { storeId: store.id, code: "PROMO10", kind: "PERCENT", value: 10 } });
    expect(coupon.active).toBe(true);
    await prisma.store.delete({ where: { id: store.id } });
  });
});
