import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST, GET } from "@/app/api/stores/[storeId]/products/[productId]/addons/route";
import { PATCH, DELETE } from "@/app/api/stores/[storeId]/products/[productId]/addons/[addonId]/route";

describe("addons API", () => {
  let storeId: string, productId: string, otherStoreId: string;
  beforeEach(async () => {
    storeId = (await prisma.store.create({ data: { slug: "addon-teste", name: "T" } })).id;
    otherStoreId = (await prisma.store.create({ data: { slug: "addon-outra", name: "Outra" } })).id;
    productId = (await prisma.product.create({ data: { storeId, name: "Pizza", priceCents: 4000 } })).id;
  });
  afterEach(async () => {
    await prisma.store.deleteMany({ where: { id: { in: [storeId, otherStoreId] } } });
  });

  function hostFor(slug: string) {
    return { headers: { host: `${slug}.dominio.com` } };
  }

  it("creates a required single-choice addon group entry", async () => {
    const res = await POST(
      new Request("http://x", { method: "POST", body: JSON.stringify({ groupName: "Tamanho", name: "Grande", priceCents: 500, required: true, multiple: false }), ...hostFor("addon-teste") }),
      { params: { storeId, productId } } as any,
    );
    expect(res.status).toBe(201);
  });

  it("groups addons by groupName on GET", async () => {
    await prisma.productAddon.create({ data: { storeId, productId, groupName: "Borda", name: "Catupiry", priceCents: 600 } });
    const res = await GET(new Request("http://x", hostFor("addon-teste")), { params: { storeId, productId } } as any);
    const body = await res.json();
    expect(Object.keys(body)).toContain("Borda");
  });

  it("rejects a request whose URL storeId does not match the Host-resolved store", async () => {
    const res = await POST(
      new Request("http://x", { method: "POST", body: JSON.stringify({ groupName: "Tamanho", name: "Grande" }), ...hostFor("addon-teste") }),
      { params: { storeId: otherStoreId, productId } } as any,
    );
    expect(res.status).toBe(403);
  });

  it("rejects PATCH on another store's addon even with a guessed valid id (not found, not another store's data)", async () => {
    const addon = await prisma.productAddon.create({ data: { storeId, productId, groupName: "Molho", name: "Barbecue", priceCents: 0 } });
    const res = await PATCH(
      new Request("http://x", { method: "PATCH", body: JSON.stringify({ name: "Hackeado" }), ...hostFor("addon-outra") }),
      { params: { storeId: otherStoreId, productId, addonId: addon.id } } as any,
    );
    expect(res.status).toBe(404);
    const unchanged = await prisma.productAddon.findUnique({ where: { id: addon.id } });
    expect(unchanged?.name).toBe("Barbecue");
  });

  it("rejects DELETE on another store's addon even with a guessed valid id (not found, not deleted)", async () => {
    const addon = await prisma.productAddon.create({ data: { storeId, productId, groupName: "Molho", name: "Barbecue", priceCents: 0 } });
    const res = await DELETE(
      new Request("http://x", { method: "DELETE", ...hostFor("addon-outra") }),
      { params: { storeId: otherStoreId, productId, addonId: addon.id } } as any,
    );
    expect(res.status).toBe(404);
    const stillThere = await prisma.productAddon.findUnique({ where: { id: addon.id } });
    expect(stillThere).not.toBeNull();
  });

  it("does not let PATCH move an addon to a different product via the request body", async () => {
    const addon = await prisma.productAddon.create({ data: { storeId, productId, groupName: "Molho", name: "Barbecue", priceCents: 0 } });
    const res = await PATCH(
      new Request("http://x", { method: "PATCH", body: JSON.stringify({ productId: "some-other-product", name: "Ainda aqui" }), ...hostFor("addon-teste") }),
      { params: { storeId, productId, addonId: addon.id } } as any,
    );
    expect(res.status).toBe(200);
    const updated = await prisma.productAddon.findUnique({ where: { id: addon.id } });
    expect(updated?.productId).toBe(productId);
  });

  it("returns 404 when creating an addon for a product that does not exist", async () => {
    const res = await POST(
      new Request("http://x", { method: "POST", body: JSON.stringify({ groupName: "Tamanho", name: "Grande" }), ...hostFor("addon-teste") }),
      { params: { storeId, productId: "nao-existe" } } as any,
    );
    expect(res.status).toBe(404);
  });
});
