import { describe, it, expect } from "vitest";
import { buildPrintPayload } from "@/lib/print/buildPrintPayload";

describe("buildPrintPayload", () => {
  it("builds a comanda payload from an order and its items", () => {
    const order = { id: "o1", channel: "SALAO", tableNumber: "5", totalCents: 4500, status: "PREPARING" } as any;
    const items = [{ productId: "p1", quantity: 2, unitPriceCents: 1500, addons: [] }] as any;
    const payload = buildPrintPayload(order, items);
    expect(payload.templateId).toBe("comanda");
    expect(payload.data.tableNumber).toBe("5");
    expect(payload.data.totalCents).toBe(4500);
  });

  it("builds a recibo payload for a completed order", () => {
    const order = { id: "o2", channel: "DELIVERY", tableNumber: null, totalCents: 3000, status: "COMPLETED" } as any;
    const items = [{ productId: "p1", quantity: 1, unitPriceCents: 3000, addons: [] }] as any;
    const payload = buildPrintPayload(order, items);
    expect(payload.templateId).toBe("recibo");
  });
});
