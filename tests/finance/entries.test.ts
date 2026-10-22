import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/stores/[storeId]/finance/entries/route";
import { PATCH } from "@/app/api/stores/[storeId]/finance/entries/[entryId]/route";

describe("finance entries API", () => {
  let storeId: string;
  beforeEach(async () => { storeId = (await prisma.store.create({ data: { slug: "entries-teste", name: "T" } })).id; });
  afterEach(async () => { await prisma.store.delete({ where: { id: storeId } }); });

  function hostFor(slug: string) {
    return { headers: { host: `${slug}.dominio.com` } };
  }

  it("creates a manual payable, ignoring any client-sent orderId", async () => {
    const res = await POST(
      new Request("http://x", { method: "POST", body: JSON.stringify({ kind: "EXPENSE", amountCents: 3000, description: "Fornecedor", dueDate: new Date().toISOString(), orderId: "forjado" }), ...hostFor("entries-teste") }),
      { params: Promise.resolve({ storeId }) } as any,
    );
    const body = await res.json();
    expect(body.orderId).toBeNull();
  });

  it("settles a pending entry via PATCH", async () => {
    const entry = await prisma.financeEntry.create({ data: { storeId, kind: "EXPENSE", amountCents: 100, description: "X", dueDate: new Date() } });
    const res = await PATCH(
      new Request("http://x", { method: "PATCH", body: JSON.stringify({ paidAt: new Date().toISOString() }), ...hostFor("entries-teste") }),
      { params: Promise.resolve({ storeId, entryId: entry.id }) } as any,
    );
    expect(res.status).toBe(200);
  });
});
