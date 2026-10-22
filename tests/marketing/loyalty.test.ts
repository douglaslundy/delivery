import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { PUT } from "@/app/api/stores/[storeId]/loyalty/route";

describe("loyalty program API", () => {
  let storeId: string;
  beforeEach(async () => { storeId = (await prisma.store.create({ data: { slug: "loyalty-teste", name: "T" } })).id; });
  afterEach(async () => { await prisma.store.delete({ where: { id: storeId } }); });

  function hostFor(slug: string) {
    return { headers: { host: `${slug}.dominio.com` } };
  }

  it("upserts the store's loyalty config", async () => {
    const res = await PUT(
      new Request("http://x", { method: "PUT", body: JSON.stringify({ pointsPerCurrencyUnit: 1, redemptionRuleCents: 1000 }), ...hostFor("loyalty-teste") }),
      { params: Promise.resolve({ storeId }) } as any,
    );
    expect(res.status).toBe(200);
  });
});
