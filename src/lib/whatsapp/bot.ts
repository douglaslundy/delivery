import { prisma } from "@/lib/prisma";
import type { EvolutionClient } from "@/lib/whatsapp/evolutionClient";

const TERMINAL_STATUSES = ["DELIVERED", "COMPLETED", "CANCELED"];
const STATUS_KEYWORDS = ["onde esta", "onde está", "status"];

export async function handleIncomingMessage(
  storeId: string,
  from: string,
  text: string,
  client: EvolutionClient,
): Promise<void> {
  const normalized = text.toLowerCase();
  const asksStatus = STATUS_KEYWORDS.some((keyword) => normalized.includes(keyword));

  if (asksStatus) {
    const order = await prisma.order.findFirst({
      where: { storeId, customerId: from, status: { notIn: TERMINAL_STATUSES as never[] } },
      orderBy: { createdAt: "desc" },
    });

    if (order) {
      await client.sendMessage(from, `Seu pedido esta com status: ${order.status}`);
      return;
    }
  }

  await client.sendMessage(from, "Um atendente vai te responder em breve.");
}
