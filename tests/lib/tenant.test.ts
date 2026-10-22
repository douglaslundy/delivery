import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resolveStoreBySubdomain } from "@/lib/tenant";

describe("resolveStoreBySubdomain", () => {
  beforeAll(async () => {
    await prisma.store.create({ data: { slug: "ativa", name: "Loja Ativa" } });
    await prisma.store.create({ data: { slug: "inativa", name: "Loja Inativa", active: false } });
  });
  afterAll(async () => {
    await prisma.store.deleteMany({ where: { slug: { in: ["ativa", "inativa"] } } });
  });

  it("resolves an active store from its subdomain", async () => {
    const store = await resolveStoreBySubdomain("ativa.dominio.com");
    expect(store?.slug).toBe("ativa");
  });

  it("returns null for an inactive store", async () => {
    const store = await resolveStoreBySubdomain("inativa.dominio.com");
    expect(store).toBeNull();
  });

  it("returns null for an unknown subdomain", async () => {
    const store = await resolveStoreBySubdomain("nao-existe.dominio.com");
    expect(store).toBeNull();
  });
});
