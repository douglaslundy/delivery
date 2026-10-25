import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { createFakeEvolutionClient } from "@/lib/whatsapp/evolutionClient";
import { runBillReminders, runSalesRecovery } from "@/lib/cron/jobs";

const SLUG = "cron-teste-loja";

describe("cron jobs", () => {
  afterAll(async () => {
    await prisma.store.deleteMany({ where: { slug: SLUG } });
  });

  it("sends recovery once per period and one reminder per bill", async () => {
    const store = await prisma.store.create({
      data: {
        slug: SLUG,
        name: "Cron Teste",
        whatsappInstance: {
          create: { evolutionInstanceName: "cron-teste-inst", evolutionApiUrl: "http://x", apiKeyEncrypted: "x", connected: true, phoneNumber: "5511900000000" },
        },
      },
    });
    const old = new Date(Date.now() - 45 * 86400000);
    await prisma.order.create({
      data: { storeId: store.id, customerId: "5511911112222", channel: "DELIVERY", subtotalCents: 100, totalCents: 100, createdAt: old },
    });
    await prisma.financeEntry.create({
      data: { storeId: store.id, kind: "EXPENSE", amountCents: 12345, description: "Luz", dueDate: new Date() },
    });

    const fake = createFakeEvolutionClient();
    const clientFor = async () => fake;

    expect(await runSalesRecovery(new Date(), clientFor)).toBe(1);
    expect(await runSalesRecovery(new Date(), clientFor)).toBe(0);
    expect(await runBillReminders(new Date(), clientFor)).toBe(1);
    expect(await runBillReminders(new Date(), clientFor)).toBe(0);

    expect(fake.sentMessages.map((m) => m.to)).toEqual(["5511911112222", "5511900000000"]);
    expect(fake.sentMessages[1].text).toContain("R$ 123,45");

    await prisma.recoveryMessage.deleteMany({ where: { storeId: store.id } });
  });
});
