import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/stores/[storeId]/finance/categories/route";

describe("finance categories API", () => {
  let storeId: string;
  beforeEach(async () => { storeId = (await prisma.store.create({ data: { slug: "cat-fin-teste", name: "T" } })).id; });
  afterEach(async () => { await prisma.store.delete({ where: { id: storeId } }); });

  function hostFor(slug: string) {
    return { headers: { host: `${slug}.dominio.com` } };
  }

  it("creates an expense category", async () => {
    const res = await POST(
      new Request("http://x", { method: "POST", body: JSON.stringify({ name: "Fornecedores", kind: "EXPENSE" }), ...hostFor("cat-fin-teste") }),
      { params: Promise.resolve({ storeId }) } as any,
    );
    expect(res.status).toBe(201);
  });
});
