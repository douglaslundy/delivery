import type { Order, OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createEvolutionClient, type EvolutionClient } from "@/lib/whatsapp/evolutionClient";

const STATUS_MESSAGES: Record<OrderStatus, string> = {
  RECEIVED: "Recebemos seu pedido!",
  CONFIRMED: "Seu pedido foi confirmado.",
  PREPARING: "Seu pedido esta sendo preparado.",
  READY: "Seu pedido esta pronto.",
  OUT_FOR_DELIVERY: "Seu pedido saiu para entrega.",
  DELIVERED: "Seu pedido foi entregue.",
  COMPLETED: "Seu pedido foi concluido.",
  CANCELED: "Seu pedido foi cancelado.",
};

export async function sendOrderStatusNotification(
  storeId: string,
  order: Pick<Order, "id" | "customerId" | "status">,
  client?: EvolutionClient,
): Promise<void> {
  if (!order.customerId) return;

  const resolvedClient = client ?? (await resolveClient(storeId));
  if (!resolvedClient) return;

  await resolvedClient.sendMessage(order.customerId, STATUS_MESSAGES[order.status]);
}

async function resolveClient(storeId: string): Promise<EvolutionClient | null> {
  const instance = await prisma.whatsappInstance.findUnique({ where: { storeId } });
  if (!instance) return null;
  return createEvolutionClient(instance);
}
