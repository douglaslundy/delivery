import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { PATCH } from "@/app/api/stores/[storeId]/orders/[orderId]/status/route";

describe("order status transition endpoint", () => {
  let storeId: string, orderId: string;
  beforeEach(async () => {
    storeId = (await prisma.store.create({ data: { slug: "status-teste", name: "T" } })).id;
    const order = await prisma.order.create({ data: { storeId, channel: "PDV", subtotalCents: 100, totalCents: 100 } });
    orderId = order.id;
  });
  afterEach(async () => { await prisma.store.delete({ where: { id: storeId } }); });

  function hostFor(slug: string) {
    return { headers: { host: `${slug}.dominio.com` } };
  }

  it("accepts a valid transition and records the event", async () => {
    const res = await PATCH(
      new Request("http://x", { method: "PATCH", body: JSON.stringify({ status: "CONFIRMED" }), ...hostFor("status-teste") }),
      { params: { storeId, orderId } } as any,
    );
    expect(res.status).toBe(200);
    const events = await prisma.orderStatusEvent.findMany({ where: { orderId } });
    expect(events.map((e) => e.status)).toContain("CONFIRMED");
  });

  it("rejects an invalid transition with 409", async () => {
    const res = await PATCH(
      new Request("http://x", { method: "PATCH", body: JSON.stringify({ status: "DELIVERED" }), ...hostFor("status-teste") }),
      { params: { storeId, orderId } } as any,
    );
    expect(res.status).toBe(409);
  });

  it("only applies one of two concurrent identical transitions, not both", async () => {
    const makeRequest = () =>
      PATCH(
        new Request("http://x", { method: "PATCH", body: JSON.stringify({ status: "CONFIRMED" }), ...hostFor("status-teste") }),
        { params: { storeId, orderId } } as any,
      );

    const [first, second] = await Promise.all([makeRequest(), makeRequest()]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);

    const events = await prisma.orderStatusEvent.findMany({ where: { orderId, status: "CONFIRMED" } });
    expect(events).toHaveLength(1);
  });

  it("awards loyalty points when a customer order completes with an active loyalty program", async () => {
    await prisma.loyaltyProgram.create({ data: { storeId, pointsPerCurrencyUnit: 1, redemptionRuleCents: 1000 } });
    const order = await prisma.order.create({
      data: { storeId, channel: "PDV", status: "READY", customerId: "cliente-1", subtotalCents: 2000, totalCents: 2000 },
    });

    const res = await PATCH(
      new Request("http://x", { method: "PATCH", body: JSON.stringify({ status: "COMPLETED" }), ...hostFor("status-teste") }),
      { params: { storeId, orderId: order.id } } as any,
    );
    expect(res.status).toBe(200);

    const ledger = await prisma.loyaltyPointsLedger.findFirst({ where: { storeId, orderId: order.id } });
    expect(ledger?.points).toBe(20);
  });
});
