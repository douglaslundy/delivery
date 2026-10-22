import { prisma } from "@/lib/prisma";

export class CashbackError extends Error {}

export async function getCashbackBalance(storeId: string, customerId: string): Promise<number> {
  const entries = await prisma.cashbackLedger.findMany({ where: { storeId, customerId } });
  return entries.reduce((sum, entry) => sum + entry.amountCents, 0);
}

export async function applyCashbackCredit(storeId: string, customerId: string, orderId: string | null, amountCents: number): Promise<void> {
  await prisma.cashbackLedger.create({ data: { storeId, customerId, orderId, amountCents } });
}

export async function debitCashback(storeId: string, customerId: string, amountCents: number): Promise<void> {
  const balance = await getCashbackBalance(storeId, customerId);
  if (amountCents > balance) {
    throw new CashbackError("debit exceeds current balance");
  }

  await prisma.cashbackLedger.create({ data: { storeId, customerId, orderId: null, amountCents: -amountCents } });
}
