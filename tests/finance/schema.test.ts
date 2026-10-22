import { prisma } from "@/lib/prisma";
import { describe, it, expect } from "vitest";

describe("finance schema", () => {
  it("creates a manual payable entry", async () => {
    const store = await prisma.store.create({ data: { slug: "finance-schema-teste", name: "T" } });
    const entry = await prisma.financeEntry.create({
      data: { storeId: store.id, kind: "EXPENSE", amountCents: 5000, description: "Aluguel", dueDate: new Date() },
    });
    expect(entry.orderId).toBeNull();
    await prisma.store.delete({ where: { id: store.id } });
  });
});
