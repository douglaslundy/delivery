import { assertFeature, planGuard } from "@/lib/plans/enforce";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isStoreRequestAuthorized } from "@/lib/menu/guard";
import { pickAllowedEntryFields, validateEntryInput } from "@/lib/finance/validateEntryInput";

export async function GET(request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  {
    const blocked = await planGuard(() => assertFeature(storeId, "finance"));
    if (blocked) return blocked;
  }

  const entries = await prisma.financeEntry.findMany({ where: { storeId } });
  return NextResponse.json(entries);
}

export async function POST(request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  {
    const blocked = await planGuard(() => assertFeature(storeId, "finance"));
    if (blocked) return blocked;
  }

  const body = await request.json();

  const error = await validateEntryInput(storeId, body);
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  const entry = await prisma.financeEntry.create({
    data: { storeId, orderId: null, ...pickAllowedEntryFields(body) } as Prisma.FinanceEntryUncheckedCreateInput,
  });

  return NextResponse.json(entry, { status: 201 });
}
