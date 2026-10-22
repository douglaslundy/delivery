import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/stores/[storeId]/products/route";

describe("products API", () => {
  let storeId: string;
  beforeEach(async () => { storeId = (await prisma.store.create({ data: { slug: "prod-teste", name: "T" } })).id; });
  afterEach(async () => { await prisma.store.delete({ where: { id: storeId } }); });

  it("creates a fixed-price product", async () => {
    const res = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ name: "Suco", priceCents: 800 }) }), { params: { storeId } } as any);
    expect(res.status).toBe(201);
  });

  it("creates a per-kg product", async () => {
    const res = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ name: "Feijoada self-service", pricePerKg: true, priceCents: 6900 }) }), { params: { storeId } } as any);
    expect(res.status).toBe(201);
  });

  it("rejects a product with no price at all", async () => {
    const res = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ name: "Sem preco" }) }), { params: { storeId } } as any);
    expect(res.status).toBe(400);
  });
});
