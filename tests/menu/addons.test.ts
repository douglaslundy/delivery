import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST, GET } from "@/app/api/stores/[storeId]/products/[productId]/addons/route";

describe("addons API", () => {
  let storeId: string, productId: string;
  beforeEach(async () => {
    storeId = (await prisma.store.create({ data: { slug: "addon-teste", name: "T" } })).id;
    productId = (await prisma.product.create({ data: { storeId, name: "Pizza", priceCents: 4000 } })).id;
  });
  afterEach(async () => { await prisma.store.delete({ where: { id: storeId } }); });

  it("creates a required single-choice addon group entry", async () => {
    const res = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ groupName: "Tamanho", name: "Grande", priceCents: 500, required: true, multiple: false }) }), { params: { storeId, productId } } as any);
    expect(res.status).toBe(201);
  });

  it("groups addons by groupName on GET", async () => {
    await prisma.productAddon.create({ data: { storeId, productId, groupName: "Borda", name: "Catupiry", priceCents: 600 } });
    const res = await GET(new Request("http://x"), { params: { storeId, productId } } as any);
    const body = await res.json();
    expect(Object.keys(body)).toContain("Borda");
  });
});
