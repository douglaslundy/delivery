import { NextResponse } from "next/server";
import { isStoreRequestAuthorized } from "@/lib/menu/guard";
import { getCashbackBalance, applyCashbackCredit, debitCashback, CashbackError } from "@/lib/marketing/cashback";

export async function GET(request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const customerId = url.searchParams.get("customerId");
  if (!customerId) {
    return NextResponse.json({ error: "customerId is required" }, { status: 400 });
  }

  const balanceCents = await getCashbackBalance(storeId, customerId);
  return NextResponse.json({ customerId, balanceCents });
}

export async function POST(request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json();

  try {
    if (body.action === "debit") {
      await debitCashback(storeId, body.customerId, body.amountCents);
    } else {
      await applyCashbackCredit(storeId, body.customerId, body.orderId ?? null, body.amountCents);
    }
  } catch (error) {
    if (error instanceof CashbackError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const balanceCents = await getCashbackBalance(storeId, body.customerId);
  return NextResponse.json({ customerId: body.customerId, balanceCents }, { status: 201 });
}
