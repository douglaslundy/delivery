import { describe, it, expect, vi } from "vitest";
import { publishOrderEvent } from "@/lib/orders/publishOrderEvent";
import * as realtime from "@/server/realtime";

describe("publishOrderEvent", () => {
  it("broadcasts to kds and orders rooms, and the delivery room when assigned", () => {
    const broadcast = vi.spyOn(realtime, "broadcast").mockImplementation(() => {});
    publishOrderEvent("store-a", { id: "o1", status: "READY", channel: "DELIVERY", updatedAt: new Date(), deliveryId: "d1" } as any);
    const rooms = broadcast.mock.calls.map((c) => c[0]);
    expect(rooms).toContain("store:store-a:kds");
    expect(rooms).toContain("store:store-a:orders");
    expect(rooms).toContain("store:store-a:delivery:d1");
  });
});
