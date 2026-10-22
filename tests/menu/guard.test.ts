import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { isStoreRequestAuthorized } from "@/lib/menu/guard";

describe("isStoreRequestAuthorized", () => {
  let storeA: string;

  beforeEach(async () => {
    storeA = (await prisma.store.create({ data: { slug: "guard-a", name: "A" } })).id;
  });
  afterEach(async () => {
    await prisma.store.delete({ where: { id: storeA } });
  });

  it("authorizes when the URL storeId matches the Host-resolved store", async () => {
    const request = new Request("http://x", { headers: { host: "guard-a.dominio.com" } });
    expect(await isStoreRequestAuthorized(request, storeA)).toBe(true);
  });

  it("rejects when the URL storeId does not match the Host-resolved store", async () => {
    const request = new Request("http://x", { headers: { host: "guard-a.dominio.com" } });
    expect(await isStoreRequestAuthorized(request, "some-other-store-id")).toBe(false);
  });

  it("rejects when the Host does not resolve to any store", async () => {
    const request = new Request("http://x", { headers: { host: "nao-existe.dominio.com" } });
    expect(await isStoreRequestAuthorized(request, storeA)).toBe(false);
  });
});
