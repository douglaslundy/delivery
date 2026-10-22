import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/stores/[storeId]/products/route";
import { PATCH } from "@/app/api/stores/[storeId]/products/[productId]/route";

describe("products API", () => {
  let storeId: string, otherStoreId: string;
  beforeEach(async () => {
    storeId = (await prisma.store.create({ data: { slug: "prod-teste", name: "T" } })).id;
    otherStoreId = (await prisma.store.create({ data: { slug: "prod-outra", name: "Outra" } })).id;
  });
  afterEach(async () => {
    await prisma.store.deleteMany({ where: { id: { in: [storeId, otherStoreId] } } });
  });

  function hostFor(slug: string) {
    return { headers: { host: `${slug}.dominio.com` } };
  }

  it("creates a fixed-price product", async () => {
    const res = await POST(
      new Request("http://x", { method: "POST", body: JSON.stringify({ name: "Suco", priceCents: 800 }), ...hostFor("prod-teste") }),
      { params: { storeId } } as any,
    );
    expect(res.status).toBe(201);
  });

  it("creates a per-kg product", async () => {
    const res = await POST(
      new Request("http://x", { method: "POST", body: JSON.stringify({ name: "Feijoada self-service", pricePerKg: true, priceCents: 6900 }), ...hostFor("prod-teste") }),
      { params: { storeId } } as any,
    );
    expect(res.status).toBe(201);
  });

  it("rejects a product with no price at all", async () => {
    const res = await POST(
      new Request("http://x", { method: "POST", body: JSON.stringify({ name: "Sem preco" }), ...hostFor("prod-teste") }),
      { params: { storeId } } as any,
    );
    expect(res.status).toBe(400);
  });

  it("rejects a request whose URL storeId does not match the Host-resolved store", async () => {
    const res = await POST(
      new Request("http://x", { method: "POST", body: JSON.stringify({ name: "Invasao", priceCents: 100 }), ...hostFor("prod-teste") }),
      { params: { storeId: otherStoreId } } as any,
    );
    expect(res.status).toBe(403);
  });

  it("does not let PATCH move a product to a different store via the request body", async () => {
    const product = await prisma.product.create({ data: { storeId, name: "Original", priceCents: 500 } });
    const res = await PATCH(
      new Request("http://x", { method: "PATCH", body: JSON.stringify({ storeId: otherStoreId, name: "Ainda aqui" }), ...hostFor("prod-teste") }),
      { params: { storeId, productId: product.id } } as any,
    );
    expect(res.status).toBe(200);
    const updated = await prisma.product.findUnique({ where: { id: product.id } });
    expect(updated?.storeId).toBe(storeId);
  });
});
