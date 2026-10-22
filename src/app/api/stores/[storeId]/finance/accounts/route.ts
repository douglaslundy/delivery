import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStoreRequestAuthorized } from "@/lib/menu/guard";
import { calculateAccountBalance } from "@/lib/finance/balance";

export async function GET(request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
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

  const body = await request.json();

  const account = await prisma.bankAccount.create({
    data: { storeId, name: body.name, initialBalanceCents: body.initialBalanceCents ?? 0 },
  });

  return NextResponse.json(account, { status: 201 });
}
