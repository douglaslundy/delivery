import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { encryptCredential } from "@/lib/crypto";
import { POST } from "@/app/api/webhooks/evolution/route";

describe("evolution webhook", () => {
  it("rejects a payload from an unknown instance", async () => {
    const res = await POST(new Request("http://x", { method: "POST", headers: { apikey: "qualquer" }, body: JSON.stringify({ evolutionInstanceName: "desconhecida", from: "551199999999", text: "oi" }) }));
    expect(res.status).toBe(404);
  });

  describe("with a known instance", () => {
    let storeId: string;
    beforeEach(async () => {
      storeId = (await prisma.store.create({ data: { slug: "webhook-auth-teste", name: "T" } })).id;
      await prisma.whatsappInstance.create({
        data: { storeId, evolutionInstanceName: "loja-autenticada", evolutionApiUrl: "https://exemplo.local", apiKeyEncrypted: encryptCredential("segredo-real") },
      });
    });
    afterEach(async () => { await prisma.store.delete({ where: { id: storeId } }); });

    it("rejects a payload whose apikey header doesn't match the instance's key", async () => {
      const res = await POST(new Request("http://x", { method: "POST", headers: { apikey: "chave-errada" }, body: JSON.stringify({ evolutionInstanceName: "loja-autenticada", from: "551199999999", text: "oi" }) }));
      expect(res.status).toBe(404);
    });

    it("accepts a payload whose apikey header matches the instance's key", async () => {
      const res = await POST(new Request("http://x", { method: "POST", headers: { apikey: "segredo-real" }, body: JSON.stringify({ evolutionInstanceName: "loja-autenticada", from: "551199999999", text: "oi" }) }));
      expect(res.status).toBe(200);
    });
  });
});
