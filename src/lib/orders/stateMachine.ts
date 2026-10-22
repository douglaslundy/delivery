import type { OrderChannel, OrderStatus } from "@prisma/client";

const SEQUENCES: Record<string, OrderStatus[]> = {
  PDV: ["RECEIVED", "CONFIRMED", "PREPARING", "READY", "COMPLETED"],
  SALAO: ["RECEIVED", "CONFIRMED", "PREPARING", "READY", "COMPLETED"],
  DELIVERY: ["RECEIVED", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED", "COMPLETED"],
  AGENDADO: ["RECEIVED", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED", "COMPLETED"],
};

export function canTransition(current: OrderStatus, next: OrderStatus, channel: OrderChannel): boolean {
  if (current === "COMPLETED" || current === "CANCELED") {
    return false;
  }

  if (next === "CANCELED") {
    return true;
  }

  const sequence = SEQUENCES[channel];
  const currentIndex = sequence.indexOf(current);
  const nextIndex = sequence.indexOf(next);

  return currentIndex !== -1 && nextIndex === currentIndex + 1;
}
