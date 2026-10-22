import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { getCashbackBalance, applyCashbackCredit, debitCashback, CashbackError } from "@/lib/marketing/cashback";

describe("cashback ledger", () => {
  let storeId: string;
  const customerId = "cliente-1";
  beforeEach(async () => { storeId = (await prisma.store.create({ data: { slug: "cashback-teste", name: "T" } })).id; });
  afterEach(async () => { await prisma.store.delete({ where: { id: storeId } }); });

  it("accrues and reads balance", async () => {
    await applyCashbackCredit(storeId, customerId, "o1", 500);
    expect(await getCashbackBalance(storeId, customerId)).toBe(500);
  });

  it("rejects debiting more than the balance", async () => {
    await applyCashbackCredit(storeId, customerId, "o1", 300);
    await expect(debitCashback(storeId, customerId, 400)).rejects.toThrow(CashbackError);
  });
});
