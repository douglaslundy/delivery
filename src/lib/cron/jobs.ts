import { prisma } from "@/lib/prisma";
import { findInactiveCustomers } from "@/lib/marketing/salesRecovery";
import { createEvolutionClient, type EvolutionClient } from "@/lib/whatsapp/evolutionClient";

const DAY = 86400000;
export const INACTIVE_DAYS = 30;
const MAX_PER_STORE_PER_RUN = 50;

type ClientFor = (storeId: string) => Promise<EvolutionClient | null>;

const defaultClientFor: ClientFor = async (storeId) => {
  const instance = await prisma.whatsappInstance.findUnique({ where: { storeId } });
  return instance?.connected ? createEvolutionClient(instance) : null;
};

// Cliente inativo ha INACTIVE_DAYS recebe 1 mensagem; nova so apos outro periodo inteiro.
export async function runSalesRecovery(now = new Date(), clientFor: ClientFor = defaultClientFor): Promise<number> {
  let sent = 0;
  const stores = await prisma.store.findMany({ where: { active: true, whatsappInstance: { connected: true } } });
  for (const store of stores) {
    const client = await clientFor(store.id);
    if (!client) continue;
    const inactive = await findInactiveCustomers(store.id, INACTIVE_DAYS);
    for (const { customerId } of inactive.slice(0, MAX_PER_STORE_PER_RUN)) {
      const recent = await prisma.recoveryMessage.findFirst({
        where: { storeId: store.id, customerId, sentAt: { gt: new Date(now.getTime() - INACTIVE_DAYS * DAY) } },
      });
      if (recent) continue;
      try {
        await client.sendMessage(customerId, `Sentimos sua falta! Faça um novo pedido na ${store.name} quando quiser.`);
        await prisma.recoveryMessage.create({ data: { storeId: store.id, customerId, sentAt: now } });
        sent++;
      } catch (error) {
        console.error("recuperacao falhou", store.id, error);
      }
    }
  }
  return sent;
}

// Contas a pagar nao pagas que vencem em ate 1 dia (ou ja venceram) avisam o WhatsApp da propria loja, uma vez.
export async function runBillReminders(now = new Date(), clientFor: ClientFor = defaultClientFor): Promise<number> {
  const entries = await prisma.financeEntry.findMany({
    where: { kind: "EXPENSE", paidAt: null, reminderSentAt: null, dueDate: { lte: new Date(now.getTime() + DAY) } },
    include: { store: { include: { whatsappInstance: true } } },
    take: 200,
  });
  let sent = 0;
  for (const entry of entries) {
    const phone = entry.store.whatsappInstance?.phoneNumber;
    if (!phone || !entry.store.active) continue;
    const client = await clientFor(entry.storeId);
    if (!client) continue;
    const valor = (entry.amountCents / 100).toFixed(2).replace(".", ",");
    const due = entry.dueDate!.toISOString().slice(0, 10).split("-").reverse().join("/");
    try {
      await client.sendMessage(phone, `Lembrete: conta "${entry.description}" de R$ ${valor} vence em ${due}.`);
      await prisma.financeEntry.update({ where: { id: entry.id }, data: { reminderSentAt: now } });
      sent++;
    } catch (error) {
      console.error("lembrete falhou", entry.id, error);
    }
  }
  return sent;
}
