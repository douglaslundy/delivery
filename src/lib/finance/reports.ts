import { prisma } from "@/lib/prisma";
import type { OrderChannel } from "@prisma/client";

export function startOfDayInTimezone(date: Date, timeZone: string): Date {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const hour = parts.hour === "24" ? 0 : Number(parts.hour);

  const wallClockAsUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), hour, Number(parts.minute), Number(parts.second));
  const offsetMs = wallClockAsUtc - date.getTime();

  const localMidnightAsUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), 0, 0, 0);
  return new Date(localMidnightAsUtc - offsetMs);
}

export async function cashFlowReport(storeId: string, { from, to }: { from: Date; to: Date }) {
  const entries = await prisma.financeEntry.findMany({
    where: { storeId, paidAt: { gte: from, lte: to, not: null } },
  });

  const totals = new Map<string | null, number>();
  for (const entry of entries) {
    const key = entry.bankAccountId;
    const signed = entry.kind === "INCOME" ? entry.amountCents : -entry.amountCents;
    totals.set(key, (totals.get(key) ?? 0) + signed);
  }

  return Array.from(totals.entries()).map(([bankAccountId, totalCents]) => ({ bankAccountId, totalCents }));
}

export async function payablesReceivablesReport(storeId: string, { asOf }: { asOf: Date }) {
  const store = await prisma.store.findUniqueOrThrow({ where: { id: storeId } });
  const boundary = startOfDayInTimezone(asOf, store.timezone);

  const entries = await prisma.financeEntry.findMany({
    where: { storeId, paidAt: null },
  });

  return entries.map((entry) => ({
    id: entry.id,
    description: entry.description,
    dueDate: entry.dueDate,
    amountCents: entry.amountCents,
    overdue: entry.dueDate !== null && entry.dueDate < boundary,
  }));
}

export async function revenueByChannelReport(storeId: string, { from, to }: { from: Date; to: Date }) {
  const orders = await prisma.order.findMany({
    where: { storeId, status: { not: "CANCELED" }, createdAt: { gte: from, lte: to } },
  });

  const totals = new Map<OrderChannel, number>();
  for (const order of orders) {
    totals.set(order.channel, (totals.get(order.channel) ?? 0) + order.totalCents);
  }

  return Array.from(totals.entries()).map(([channel, totalCents]) => ({ channel, totalCents }));
}
