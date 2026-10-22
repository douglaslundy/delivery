import type { Order } from "@prisma/client";
import { broadcast } from "@/server/realtime";

export function publishOrderEvent(storeId: string, order: Order): void {
  const event = {
    type: "order_status_changed" as const,
    orderId: order.id,
    status: order.status,
    channel: order.channel,
    updatedAt: order.updatedAt,
  };

  broadcast(`store:${storeId}:kds`, event);
  broadcast(`store:${storeId}:orders`, event);

  if (order.deliveryId) {
    broadcast(`store:${storeId}:delivery:${order.deliveryId}`, event);
  }
}
