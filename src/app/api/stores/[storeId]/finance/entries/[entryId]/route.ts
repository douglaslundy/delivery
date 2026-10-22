import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStoreRequestAuthorized } from "@/lib/menu/guard";

const ALLOWED_FIELDS = ["kind", "amountCents", "description", "categoryId", "bankAccountId", "dueDate", "paidAt"] as const;

function pickAllowedFields(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in body) {
      data[field] = body[field];
    }
  }
  return data;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ storeId: string; entryId: string }> },
) {
  const { storeId, entryId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json();

  const { count } = await prisma.financeEntry.updateMany({
    where: { id: entryId, storeId },
    data: pickAllowedFields(body),
  });

  if (count === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const entry = await prisma.financeEntry.findUniqueOrThrow({ where: { id: entryId } });
  return NextResponse.json(entry);
}
