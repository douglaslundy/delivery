import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { calculateAccountBalance } from "@/lib/finance/balance";

describe("calculateAccountBalance", () => {
  let storeId: string, accountId: string;
  beforeEach(async () => {
    storeId = (await prisma.store.create({ data: { slug: "balance-teste", name: "T" } })).id;
    accountId = (await prisma.bankAccount.create({ data: { storeId, name: "Caixa", initialBalanceCents: 10000 } })).id;
    await prisma.financeEntry.create({ data: { storeId, bankAccountId: accountId, kind: "INCOME", amountCents: 5000, description: "Venda", paidAt: new Date() } });
    await prisma.financeEntry.create({ data: { storeId, bankAccountId: accountId, kind: "EXPENSE", amountCents: 2000, description: "Compra", paidAt: new Date() } });
    await prisma.financeEntry.create({ data: { storeId, kind: "INCOME", amountCents: 999999, description: "Nao pago" } }); // no bankAccountId, unpaid — must not count
  });
  afterEach(async () => { await prisma.store.delete({ where: { id: storeId } }); });

  it("sums initial balance plus paid entries for that account only", async () => {
    const balance = await calculateAccountBalance(storeId, accountId);
    expect(balance).toBe(10000 + 5000 - 2000);
  });
});
