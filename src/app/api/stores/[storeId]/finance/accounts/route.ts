import { assertFeature, planGuard } from "@/lib/plans/enforce";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStoreRequestAuthorized } from "@/lib/menu/guard";
import { calculateAccountBalance } from "@/lib/finance/balance";
import { markStepDone } from "@/lib/onboarding/progress";

export async function GET(request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  {
    const blocked = await planGuard(() => assertFeature(storeId, "finance"));
    if (blocked) return blocked;
  }

  const accounts = await prisma.bankAccount.findMany({ where: { storeId } });
  const withBalance = await Promise.all(
    accounts.map(async (account) => ({ ...account, balanceCents: await calculateAccountBalance(storeId, account.id) })),
  );

  return NextResponse.json(withBalance);
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

  const account = await prisma.bankAccount.create({
    data: { storeId, name: body.name, initialBalanceCents: body.initialBalanceCents ?? 0 },
  });

  await markStepDone(storeId, "step2PaymentDone");

  return NextResponse.json(account, { status: 201 });
}
