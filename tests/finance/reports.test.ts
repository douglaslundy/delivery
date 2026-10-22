import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { cashFlowReport, payablesReceivablesReport, revenueByChannelReport, startOfDayInTimezone } from "@/lib/finance/reports";

describe("finance reports", () => {
  let storeId: string;
  beforeEach(async () => { storeId = (await prisma.store.create({ data: { slug: "reports-teste", name: "T" } })).id; });
  afterEach(async () => { await prisma.store.delete({ where: { id: storeId } }); });

  it("marks a receivable due yesterday as overdue and one due today as not", async () => {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 86400000);
    await prisma.financeEntry.create({ data: { storeId, kind: "INCOME", amountCents: 100, description: "A", dueDate: today } });
    await prisma.financeEntry.create({ data: { storeId, kind: "INCOME", amountCents: 100, description: "B", dueDate: yesterday } });
    const report = await payablesReceivablesReport(storeId, { asOf: today });
    expect(report.find(r => r.description === "A")!.overdue).toBe(false);
    expect(report.find(r => r.description === "B")!.overdue).toBe(true);
  });

  it("computes start-of-day using the given timezone, not the host's", () => {
    const instant = new Date("2026-10-22T02:00:00.000Z");
    // In America/Sao_Paulo (UTC-3), 02:00Z is still Oct 21 23:00 local — start of that day is 2026-10-21T03:00:00Z.
    expect(startOfDayInTimezone(instant, "America/Sao_Paulo").toISOString()).toBe("2026-10-21T03:00:00.000Z");
    // In UTC, 02:00Z is already Oct 22 — start of that day is 2026-10-22T00:00:00Z.
    expect(startOfDayInTimezone(instant, "UTC").toISOString()).toBe("2026-10-22T00:00:00.000Z");
  });

  it("computes overdue against the store's timezone, not the host's", async () => {
    // Store default timezone is America/Sao_Paulo (UTC-3, fixed, no DST since 2019).
    // asOf = 2026-10-22T12:00:00Z = 09:00 in Sao Paulo (Oct 22 there); start of that SP day in UTC is 2026-10-22T03:00:00Z.
    const asOf = new Date("2026-10-22T12:00:00.000Z");
    await prisma.financeEntry.create({ data: { storeId, kind: "EXPENSE", amountCents: 100, description: "antes-da-fronteira", dueDate: new Date("2026-10-22T02:00:00.000Z") } });
    await prisma.financeEntry.create({ data: { storeId, kind: "EXPENSE", amountCents: 100, description: "depois-da-fronteira", dueDate: new Date("2026-10-22T04:00:00.000Z") } });

    const report = await payablesReceivablesReport(storeId, { asOf });
    expect(report.find(r => r.description === "antes-da-fronteira")!.overdue).toBe(true);
    expect(report.find(r => r.description === "depois-da-fronteira")!.overdue).toBe(false);
  });

  it("groups paid entries with no bank account under a null key in cash flow", async () => {
    await prisma.financeEntry.create({ data: { storeId, kind: "INCOME", amountCents: 700, description: "Sem conta", paidAt: new Date() } });
    const from = new Date(Date.now() - 86400000), to = new Date(Date.now() + 86400000);
    const report = await cashFlowReport(storeId, { from, to });
    const nullBucket = report.find(r => r.bankAccountId === null);
    expect(nullBucket?.totalCents).toBe(700);
  });

  it("excludes canceled orders from revenue by channel", async () => {
    await prisma.order.create({ data: { storeId, channel: "PDV", status: "COMPLETED", subtotalCents: 1000, totalCents: 1000 } });
    await prisma.order.create({ data: { storeId, channel: "PDV", status: "CANCELED", subtotalCents: 5000, totalCents: 5000 } });
    const from = new Date(Date.now() - 86400000), to = new Date(Date.now() + 86400000);
    const report = await revenueByChannelReport(storeId, { from, to });
    expect(report.find(r => r.channel === "PDV")!.totalCents).toBe(1000);
  });
});
