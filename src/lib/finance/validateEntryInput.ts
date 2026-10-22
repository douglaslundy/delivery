import { prisma } from "@/lib/prisma";

const ALLOWED_FIELDS = ["kind", "amountCents", "description", "categoryId", "bankAccountId", "dueDate", "paidAt"] as const;

export function pickAllowedEntryFields(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in body) {
      data[field] = body[field];
    }
  }
  return data;
}

export async function validateEntryInput(storeId: string, body: Record<string, unknown>): Promise<string | null> {
  if ("kind" in body && body.kind !== "INCOME" && body.kind !== "EXPENSE") {
    return "kind must be INCOME or EXPENSE";
  }

  if ("amountCents" in body && (typeof body.amountCents !== "number" || !Number.isInteger(body.amountCents) || body.amountCents <= 0)) {
    return "amountCents must be a positive integer";
  }

  if (body.bankAccountId) {
    const account = await prisma.bankAccount.findFirst({ where: { id: body.bankAccountId as string, storeId } });
    if (!account) return "bankAccountId does not belong to this store";
  }

  if (body.categoryId) {
    const category = await prisma.financeCategory.findFirst({ where: { id: body.categoryId as string, storeId } });
    if (!category) return "categoryId does not belong to this store";
  }

  return null;
}
