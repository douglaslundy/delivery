import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "@/app/api/stores/[storeId]/categories/route";
import { PATCH, DELETE } from "@/app/api/stores/[storeId]/categories/[categoryId]/route";

describe("categories API", () => {
  let storeA: string, storeB: string;
  beforeEach(async () => {
    storeA = (await prisma.store.create({ data: { slug: "cat-a", name: "A" } })).id;
    storeB = (await prisma.store.create({ data: { slug: "cat-b", name: "B" } })).id;
  });
  afterEach(async () => {
    await prisma.store.deleteMany({ where: { id: { in: [storeA, storeB] } } });
  });

  function hostFor(slug: string) {
    return { headers: { host: `${slug}.dominio.com` } };
  }

  it("creates a category scoped to the store", async () => {
    const res = await POST(
      new Request("http://x", { method: "POST", body: JSON.stringify({ name: "Bebidas" }), ...hostFor("cat-a") }),
      { params: { storeId: storeA } } as any,
    );
    expect(res.status).toBe(201);
  });

  it("never returns another store's categories", async () => {
    await prisma.category.create({ data: { storeId: storeB, name: "So da B" } });
    const res = await GET(new Request("http://x", hostFor("cat-a")), { params: { storeId: storeA } } as any);
    const body = await res.json();
    expect(body).toHaveLength(0);
  });

  it("rejects a request whose URL storeId does not match the Host-resolved store", async () => {
    const res = await POST(
      new Request("http://x", { method: "POST", body: JSON.stringify({ name: "Invasao" }), ...hostFor("cat-a") }),
      { params: { storeId: storeB } } as any,
    );
    expect(res.status).toBe(403);
  });

  it("rejects PATCH on another store's category even with a guessed valid id", async () => {
    const category = await prisma.category.create({ data: { storeId: storeB, name: "Da B" } });
    const res = await PATCH(
      new Request("http://x", { method: "PATCH", body: JSON.stringify({ name: "Hackeado" }), ...hostFor("cat-a") }),
      { params: { storeId: storeB, categoryId: category.id } } as any,
    );
    expect(res.status).toBe(403);
  });

  it("rejects DELETE on another store's category even with a guessed valid id", async () => {
    const category = await prisma.category.create({ data: { storeId: storeB, name: "Da B" } });
    const res = await DELETE(
      new Request("http://x", { method: "DELETE", ...hostFor("cat-a") }),
      { params: { storeId: storeB, categoryId: category.id } } as any,
    );
    expect(res.status).toBe(403);
  });

  it("does not let PATCH move a category to a different store via the request body", async () => {
    const category = await prisma.category.create({ data: { storeId: storeA, name: "Original" } });
    const res = await PATCH(
      new Request("http://x", { method: "PATCH", body: JSON.stringify({ storeId: storeB, name: "Ainda A" }), ...hostFor("cat-a") }),
      { params: { storeId: storeA, categoryId: category.id } } as any,
    );
    expect(res.status).toBe(200);
    const updated = await prisma.category.findUnique({ where: { id: category.id } });
    expect(updated?.storeId).toBe(storeA);
  });

  it("returns 409 when deleting a category that still has products", async () => {
    const category = await prisma.category.create({ data: { storeId: storeA, name: "Com produto" } });
    await prisma.product.create({ data: { storeId: storeA, categoryId: category.id, name: "X", priceCents: 100 } });
    const res = await DELETE(
      new Request("http://x", { method: "DELETE", ...hostFor("cat-a") }),
      { params: { storeId: storeA, categoryId: category.id } } as any,
    );
    expect(res.status).toBe(409);
  });
});
