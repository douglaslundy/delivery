import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/stores/[storeId]/whatsapp/route";

describe("whatsapp instance API", () => {
  let storeId: string;
  beforeEach(async () => { storeId = (await prisma.store.create({ data: { slug: "wa-teste", name: "T" } })).id; });
  afterEach(async () => { await prisma.store.delete({ where: { id: storeId } }); });

  function hostFor(slug: string) {
    return { headers: { host: `${slug}.dominio.com` } };
  }

  it("stores the API key encrypted, never plaintext", async () => {
    await POST(
      new Request("http://x", { method: "POST", body: JSON.stringify({ evolutionInstanceName: "loja-x", evolutionApiUrl: "https://exemplo.local", apiKey: "chave-secreta" }), ...hostFor("wa-teste") }),
      { params: Promise.resolve({ storeId }) } as any,
    );
    const row = await prisma.whatsappInstance.findUniqueOrThrow({ where: { storeId } });
    expect(row.apiKeyEncrypted).not.toContain("chave-secreta");
  });
});
