import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/stores/[storeId]/feedback/route";

describe("customer feedback API", () => {
  let storeId: string;
  beforeEach(async () => { storeId = (await prisma.store.create({ data: { slug: "feedback-teste", name: "T" } })).id; });
  afterEach(async () => { await prisma.store.delete({ where: { id: storeId } }); });

  function hostFor(slug: string) {
    return { headers: { host: `${slug}.dominio.com` } };
  }

  it("creates feedback for a store", async () => {
    const res = await POST(
      new Request("http://x", { method: "POST", body: JSON.stringify({ rating: 5, comment: "Otimo" }), ...hostFor("feedback-teste") }),
      { params: Promise.resolve({ storeId }) } as any,
    );
    expect(res.status).toBe(201);
  });
});
