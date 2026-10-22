import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { validateAndPriceCoupon, CouponError } from "@/lib/marketing/coupons";

describe("validateAndPriceCoupon", () => {
  let storeId: string;
  beforeEach(async () => { storeId = (await prisma.store.create({ data: { slug: "coupon-teste", name: "T" } })).id; });
  afterEach(async () => { await prisma.store.delete({ where: { id: storeId } }); });

  it("prices a percent coupon", async () => {
    await prisma.coupon.create({ data: { storeId, code: "DEZ", kind: "PERCENT", value: 10 } });
    const { discountCents } = await validateAndPriceCoupon(storeId, "DEZ", 10000);
    expect(discountCents).toBe(1000);
  });

  it("rejects an expired coupon", async () => {
    await prisma.coupon.create({ data: { storeId, code: "VENCIDO", kind: "FIXED", value: 500, expiresAt: new Date(Date.now() - 86400000) } });
    await expect(validateAndPriceCoupon(storeId, "VENCIDO", 10000)).rejects.toThrow(CouponError);
  });

  it("rejects a code at its usage limit", async () => {
    await prisma.coupon.create({ data: { storeId, code: "LIMITE", kind: "FIXED", value: 100, usageLimit: 0 } });
    await expect(validateAndPriceCoupon(storeId, "LIMITE", 10000)).rejects.toThrow(CouponError);
  });
});
