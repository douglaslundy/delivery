import { describe, it, expect } from "vitest";
import { evaluateTenantGuard } from "@/middleware";

describe("evaluateTenantGuard", () => {
  it("allows a request when the session's store matches the subdomain's store", () => {
    const result = evaluateTenantGuard({ resolvedStoreId: "store-a", sessionStoreIds: ["store-a"] });
    expect(result.allowed).toBe(true);
  });

  it("blocks a request when the session belongs to a different store", () => {
    const result = evaluateTenantGuard({ resolvedStoreId: "store-b", sessionStoreIds: ["store-a"] });
    expect(result.allowed).toBe(false);
  });

  it("blocks when there is no resolved store (unknown/inactive subdomain)", () => {
    const result = evaluateTenantGuard({ resolvedStoreId: null, sessionStoreIds: ["store-a"] });
    expect(result.allowed).toBe(false);
  });
});
