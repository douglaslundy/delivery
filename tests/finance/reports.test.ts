import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { payablesReceivablesReport, revenueByChannelReport } from "@/lib/finance/reports";

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

  it("excludes canceled orders from revenue by channel", async () => {
    await prisma.order.create({ data: { storeId, channel: "PDV", status: "COMPLETED", subtotalCents: 1000, totalCents: 1000 } });
    await prisma.order.create({ data: { storeId, channel: "PDV", status: "CANCELED", subtotalCents: 5000, totalCents: 5000 } });
    const from = new Date(Date.now() - 86400000), to = new Date(Date.now() + 86400000);
    const report = await revenueByChannelReport(storeId, { from, to });
    expect(report.find(r => r.channel === "PDV")!.totalCents).toBe(1000);
  });
});
