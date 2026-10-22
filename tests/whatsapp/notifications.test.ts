import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { sendOrderStatusNotification } from "@/lib/whatsapp/notifications";
import { createFakeEvolutionClient } from "@/lib/whatsapp/evolutionClient";

describe("sendOrderStatusNotification", () => {
  let storeId: string;
  beforeEach(async () => { storeId = (await prisma.store.create({ data: { slug: "wa-notif-teste", name: "T" } })).id; });
  afterEach(async () => { await prisma.store.delete({ where: { id: storeId } }); });

  it("does nothing when the order has no customerId", async () => {
    const client = createFakeEvolutionClient();
    await sendOrderStatusNotification(storeId, { id: "o1", customerId: null, status: "CONFIRMED" }, client);
    expect(client.sentMessages).toHaveLength(0);
  });

  it("sends a status message to the order's customer", async () => {
    const client = createFakeEvolutionClient();
    await sendOrderStatusNotification(storeId, { id: "o1", customerId: "cliente-1", status: "OUT_FOR_DELIVERY" }, client);
    expect(client.sentMessages).toHaveLength(1);
    expect(client.sentMessages[0].to).toBe("cliente-1");
    expect(client.sentMessages[0].text).toMatch(/entrega/i);
  });

  it("does nothing when the store has no WhatsApp instance configured", async () => {
    await expect(
      sendOrderStatusNotification(storeId, { id: "o1", customerId: "cliente-1", status: "CONFIRMED" }),
    ).resolves.not.toThrow();
  });
});
