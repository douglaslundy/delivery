import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { handleIncomingMessage } from "@/lib/whatsapp/bot";
import { createFakeEvolutionClient } from "@/lib/whatsapp/evolutionClient";

describe("handleIncomingMessage", () => {
  let storeId: string;
  const customerId = "cliente-wa-1";
  beforeEach(async () => { storeId = (await prisma.store.create({ data: { slug: "bot-teste", name: "T" } })).id; });
  afterEach(async () => { await prisma.store.delete({ where: { id: storeId } }); });

  it("replies with the order status for a status question", async () => {
    await prisma.order.create({ data: { storeId, customerId, channel: "DELIVERY", status: "OUT_FOR_DELIVERY", subtotalCents: 100, totalCents: 100 } });
    const client = createFakeEvolutionClient();
    await handleIncomingMessage(storeId, customerId, "onde esta meu pedido?", client);
    expect(client.sentMessages[0].text).toContain("OUT_FOR_DELIVERY");
  });

  it("falls back to a generic reply for unmatched text", async () => {
    const client = createFakeEvolutionClient();
    await handleIncomingMessage(storeId, customerId, "oi, bom dia", client);
    expect(client.sentMessages[0].text).toMatch(/atendente/i);
  });
});
