import type { Order } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { publishOrderEvent } from "@/lib/orders/publishOrderEvent";

export async function assignDelivery(storeId: string, orderId: string, deliveryPersonId: string): Promise<Order> {
  const order = await prisma.order.findFirst({ where: { id: orderId, storeId } });
  if (!order) throw new Error("order does not belong to this store");

  const deliveryPerson = await prisma.deliveryPerson.findFirst({ where: { id: deliveryPersonId, storeId } });
  if (!deliveryPerson) throw new Error("delivery person does not belong to this store");

  const updated = await prisma.order.update({
    where: { storeId_id: { storeId, id: orderId } },
    data: { deliveryId: deliveryPersonId },
  });

  publishOrderEvent(storeId, updated);

  return updated;
}
