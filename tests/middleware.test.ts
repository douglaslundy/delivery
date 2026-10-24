import { describe, it, expect } from "vitest";
import { config } from "@/middleware";

describe("middleware matcher", () => {
  const pattern = new RegExp(`^${config.matcher[0]}$`);

  it("excludes the evolution webhook (no session/host guard applies there)", () => {
    expect(pattern.test("/api/webhooks/evolution")).toBe(false);
  });

  it("still covers an ordinary store API route", () => {
    expect(pattern.test("/api/stores/abc/orders")).toBe(true);
  });

  it("excludes the Caddy on-demand TLS ask endpoint (called before any session/host exists)", () => {
    expect(pattern.test("/api/tls-check")).toBe(false);
  });

  it("excludes the platform admin area (guarded by requirePlatformAdmin instead of the tenant host)", () => {
    expect(pattern.test("/admin")).toBe(false);
    expect(pattern.test("/admin/lojas")).toBe(false);
    expect(pattern.test("/api/admin/stores")).toBe(false);
  });
});
