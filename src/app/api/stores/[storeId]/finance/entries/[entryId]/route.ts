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
