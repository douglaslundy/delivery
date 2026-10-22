import { prisma } from "@/lib/prisma";
import { describe, it, expect } from "vitest";

describe("Store schema", () => {
  it("creates a store with a unique slug", async () => {
    const store = await prisma.store.create({ data: { slug: "padaria-teste", name: "Padaria Teste" } });
    expect(store.active).toBe(true);
    await prisma.store.delete({ where: { id: store.id } });
  });
});
