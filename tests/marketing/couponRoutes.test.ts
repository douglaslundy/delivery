import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/stores/[storeId]/coupons/route";
import { PATCH } from "@/app/api/stores/[storeId]/coupons/[couponId]/route";

describe("coupon routes validation", () => {
  let storeId: string;
  beforeEach(async () => { storeId = (await prisma.store.create({ data: { slug: "coupon-routes-teste", name: "T" } })).id; });
  afterEach(async () => { await prisma.store.delete({ where: { id: storeId } }); });

  function hostFor(slug: string) {
    return { headers: { host: `${slug}.dominio.com` } };
  }

  it("rejects POST without a code", async () => {
    const res = await POST(
      new Request("http://x", { method: "POST", body: JSON.stringify({ kind: "FIXED", value: 100 }), ...hostFor("coupon-routes-teste") }),
      { params: Promise.resolve({ storeId }) } as any,
    );
    expect(res.status).toBe(400);
  });

  it("rejects POST with a PERCENT value above 100", async () => {
    const res = await POST(
      new Request("http://x", { method: "POST", body: JSON.stringify({ code: "X", kind: "PERCENT", value: 150 }), ...hostFor("coupon-routes-teste") }),
      { params: Promise.resolve({ storeId }) } as any,
    );
    expect(res.status).toBe(400);
  });

  it("rejects PATCH that pushes an existing PERCENT coupon's value above 100", async () => {
    const coupon = await prisma.coupon.create({ data: { storeId, code: "Y", kind: "PERCENT", value: 10 } });
    const res = await PATCH(
      new Request("http://x", { method: "PATCH", body: JSON.stringify({ value: 150 }), ...hostFor("coupon-routes-teste") }),
      { params: Promise.resolve({ storeId, couponId: coupon.id }) } as any,
    );
    expect(res.status).toBe(400);
  });
});
