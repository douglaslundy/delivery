import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "@/app/api/stores/[storeId]/categories/route";

describe("categories API", () => {
  let storeA: string, storeB: string;
  beforeEach(async () => {
    storeA = (await prisma.store.create({ data: { slug: "cat-a", name: "A" } })).id;
    storeB = (await prisma.store.create({ data: { slug: "cat-b", name: "B" } })).id;
  });
  afterEach(async () => {
    await prisma.store.deleteMany({ where: { id: { in: [storeA, storeB] } } });
  });

  it("creates a category scoped to the store", async () => {
    const res = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ name: "Bebidas" }) }), { params: { storeId: storeA } } as any);
    expect(res.status).toBe(201);
  });

  it("never returns another store's categories", async () => {
    await prisma.category.create({ data: { storeId: storeB, name: "So da B" } });
    const res = await GET(new Request("http://x"), { params: { storeId: storeA } } as any);
    const body = await res.json();
    expect(body).toHaveLength(0);
  });
});
