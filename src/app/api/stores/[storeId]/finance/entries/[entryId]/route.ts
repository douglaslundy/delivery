import { assertFeature, planGuard } from "@/lib/plans/enforce";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStoreRequestAuthorized } from "@/lib/menu/guard";
import { pickAllowedEntryFields, validateEntryInput } from "@/lib/finance/validateEntryInput";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ storeId: string; entryId: string }> },
) {
  const { storeId, entryId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  {
    const blocked = await planGuard(() => assertFeature(storeId, "finance"));
    if (blocked) return blocked;
  }

  const existing = await prisma.financeEntry.findFirst({ where: { id: entryId, storeId } });
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (existing.orderId) {
    return NextResponse.json({ error: "entry is system-generated and cannot be edited" }, { status: 409 });
  }

  const body = await request.json();

  const error = await validateEntryInput(storeId, body);
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  const entry = await prisma.financeEntry.update({
    where: { id: entryId },
    data: pickAllowedEntryFields(body),
  });

  return NextResponse.json(entry);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ storeId: string; entryId: string }> },
) {
  const { storeId, entryId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const blocked = await planGuard(() => assertFeature(storeId, "finance"));
  if (blocked) return blocked;

  const existing = await prisma.financeEntry.findFirst({ where: { id: entryId, storeId } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (existing.orderId) {
    return NextResponse.json({ error: "Lançamento gerado pelo sistema não pode ser excluído." }, { status: 409 });
  }

  await prisma.financeEntry.delete({ where: { id: entryId } });
  return new NextResponse(null, { status: 204 });
}
