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

  it("rejects crediting a negative amount (which would otherwise push the balance below zero)", async () => {
    await expect(applyCashbackCredit(storeId, customerId, "o1", -500)).rejects.toThrow(CashbackError);
  });

  it("rejects debiting a negative amount (which would otherwise credit the customer)", async () => {
    await applyCashbackCredit(storeId, customerId, "o1", 300);
    await expect(debitCashback(storeId, customerId, -500)).rejects.toThrow(CashbackError);
  });

  it("rejects a non-integer amount", async () => {
    await expect(applyCashbackCredit(storeId, customerId, "o1", 1.5)).rejects.toThrow(CashbackError);
  });

  it("never lets two concurrent debits together push the balance negative", async () => {
    await applyCashbackCredit(storeId, customerId, "o1", 500);

    const results = await Promise.allSettled([
      debitCashback(storeId, customerId, 300),
      debitCashback(storeId, customerId, 300),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    expect(fulfilled).toHaveLength(1);
    expect(await getCashbackBalance(storeId, customerId)).toBe(200);
  });
});
