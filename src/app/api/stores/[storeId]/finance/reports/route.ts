import { assertFeature, planGuard } from "@/lib/plans/enforce";
import { NextResponse } from "next/server";
import { isStoreRequestAuthorized } from "@/lib/menu/guard";
import { cashFlowReport, payablesReceivablesReport, revenueByChannelReport } from "@/lib/finance/reports";

export async function GET(request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  {
    const blocked = await planGuard(() => assertFeature(storeId, "finance"));
    if (blocked) return blocked;
  }

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  const now = new Date();
  const from = url.searchParams.get("from") ? new Date(url.searchParams.get("from")!) : new Date(now.getTime() - 30 * 86400000);
  const to = url.searchParams.get("to") ? new Date(url.searchParams.get("to")!) : now;

  if (kind === "cashFlow") {
    return NextResponse.json(await cashFlowReport(storeId, { from, to }));
  }
  if (kind === "payablesReceivables") {
    return NextResponse.json(await payablesReceivablesReport(storeId, { asOf: now }));
  }
  if (kind === "revenueByChannel") {
    return NextResponse.json(await revenueByChannelReport(storeId, { from, to }));
  }

  return NextResponse.json({ error: "unknown report kind" }, { status: 400 });
}
