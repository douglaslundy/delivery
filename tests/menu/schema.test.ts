import { prisma } from "@/lib/prisma";
import { describe, it, expect } from "vitest";

describe("menu schema", () => {
  it("creates a category and a fixed-price product under it", async () => {
    const store = await prisma.store.create({ data: { slug: "menu-schema-teste", name: "Teste" } });
    const category = await prisma.category.create({ data: { storeId: store.id, name: "Pizzas" } });
    const product = await prisma.product.create({
      data: { storeId: store.id, categoryId: category.id, name: "Margherita", priceCents: 4500 },
    });
    expect(product.pricePerKg).toBe(false);
    await prisma.store.delete({ where: { id: store.id } });
  });
});
