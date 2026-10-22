import { prisma } from "@/lib/prisma";

export class CashbackError extends Error {}

export async function getCashbackBalance(storeId: string, customerId: string): Promise<number> {
  const entries = await prisma.cashbackLedger.findMany({ where: { storeId, customerId } });
  return entries.reduce((sum, entry) => sum + entry.amountCents, 0);
}

function requirePositiveInteger(amountCents: number): void {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new CashbackError("amountCents must be a positive integer");
  }
}

export async function applyCashbackCredit(storeId: string, customerId: string, orderId: string | null, amountCents: number): Promise<void> {
  requirePositiveInteger(amountCents);
  await prisma.cashbackLedger.create({ data: { storeId, customerId, orderId, amountCents } });
}

export async function debitCashback(storeId: string, customerId: string, amountCents: number): Promise<void> {
  requirePositiveInteger(amountCents);

  await prisma.$transaction(async (tx) => {
    // Advisory lock serializes concurrent debits for the same (storeId, customerId)
    // so the balance check below can't race with another debit's check-then-insert.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${storeId} || ':' || ${customerId}))`;

    const entries = await tx.cashbackLedger.findMany({ where: { storeId, customerId } });
    const balance = entries.reduce((sum, entry) => sum + entry.amountCents, 0);

    if (amountCents > balance) {
      throw new CashbackError("debit exceeds current balance");
    }

    await tx.cashbackLedger.create({ data: { storeId, customerId, orderId: null, amountCents: -amountCents } });
  });
}
