import { prisma } from "@/lib/prisma";

export async function calculateAccountBalance(storeId: string, bankAccountId: string, asOf: Date = new Date()): Promise<number> {
  const account = await prisma.bankAccount.findUniqueOrThrow({ where: { id: bankAccountId } });

  const entries = await prisma.financeEntry.findMany({
    where: { storeId, bankAccountId, paidAt: { lte: asOf, not: null } },
  });

  const delta = entries.reduce((sum, entry) => sum + (entry.kind === "INCOME" ? entry.amountCents : -entry.amountCents), 0);

  return account.initialBalanceCents + delta;
}
