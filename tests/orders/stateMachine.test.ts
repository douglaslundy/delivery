import { describe, it, expect } from "vitest";
import { canTransition, nextStatus } from "@/lib/orders/stateMachine";

describe("canTransition", () => {
  it("allows the linear PDV path", () => {
    expect(canTransition("RECEIVED", "CONFIRMED", "PDV")).toBe(true);
    expect(canTransition("READY", "COMPLETED", "PDV")).toBe(true);
  });

  it("allows DELIVERY to pass through OUT_FOR_DELIVERY/DELIVERED", () => {
    expect(canTransition("READY", "OUT_FOR_DELIVERY", "DELIVERY")).toBe(true);
    expect(canTransition("OUT_FOR_DELIVERY", "DELIVERED", "DELIVERY")).toBe(true);
    expect(canTransition("DELIVERED", "COMPLETED", "DELIVERY")).toBe(true);
  });

  it("rejects OUT_FOR_DELIVERY for PDV/SALAO", () => {
    expect(canTransition("READY", "OUT_FOR_DELIVERY", "PDV")).toBe(false);
    expect(canTransition("READY", "OUT_FOR_DELIVERY", "SALAO")).toBe(false);
  });

  it("rejects skipping a step", () => {
    expect(canTransition("RECEIVED", "READY", "PDV")).toBe(false);
    expect(canTransition("RECEIVED", "DELIVERED", "DELIVERY")).toBe(false);
  });

  it("allows CANCELED from any pre-COMPLETED state", () => {
    expect(canTransition("CONFIRMED", "CANCELED", "PDV")).toBe(true);
    expect(canTransition("OUT_FOR_DELIVERY", "CANCELED", "DELIVERY")).toBe(true);
  });

  it("rejects any transition out of a terminal state", () => {
    expect(canTransition("COMPLETED", "CANCELED", "PDV")).toBe(false);
    expect(canTransition("CANCELED", "RECEIVED", "PDV")).toBe(false);
  });
});

describe("nextStatus", () => {
  it("returns the immediate next status in the channel's sequence", () => {
    expect(nextStatus("RECEIVED", "PDV")).toBe("CONFIRMED");
    expect(nextStatus("READY", "DELIVERY")).toBe("OUT_FOR_DELIVERY");
  });

  it("returns null for a terminal state", () => {
    expect(nextStatus("COMPLETED", "PDV")).toBeNull();
    expect(nextStatus("CANCELED", "PDV")).toBeNull();
  });

  it("returns null at the end of the sequence", () => {
    expect(nextStatus("READY", "PDV")).toBe("COMPLETED");
    expect(nextStatus("COMPLETED", "DELIVERY")).toBeNull();
  });
});
