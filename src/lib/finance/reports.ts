import { prisma } from "@/lib/prisma";
import type { OrderChannel } from "@prisma/client";

function startOfDay(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
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
  const boundary = startOfDay(asOf);

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
