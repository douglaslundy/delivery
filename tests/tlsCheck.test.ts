import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/tls-check/route";

describe("tls-check route (Caddy on-demand TLS ask endpoint)", () => {
  let storeId: string;
  beforeEach(async () => { storeId = (await prisma.store.create({ data: { slug: "tls-check-teste", name: "T" } })).id; });
  afterEach(async () => { await prisma.store.delete({ where: { id: storeId } }); });

  it("returns 200 for a domain that resolves to a known store", async () => {
    const res = await GET(new Request("http://x?domain=tls-check-teste.dominio.com"));
    expect(res.status).toBe(200);
  });

  it("returns 404 for an unknown domain", async () => {
    const res = await GET(new Request("http://x?domain=nao-existe.dominio.com"));
    expect(res.status).toBe(404);
  });
});
