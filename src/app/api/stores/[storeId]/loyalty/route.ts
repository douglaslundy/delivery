import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStoreRequestAuthorized } from "@/lib/menu/guard";
import { getLoyaltyPointsBalance } from "@/lib/marketing/loyaltyPoints";

export async function GET(request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const customerId = new URL(request.url).searchParams.get("customerId");
  if (customerId) {
    const pointsBalance = await getLoyaltyPointsBalance(storeId, customerId);
    return NextResponse.json({ customerId, pointsBalance });
  }

  const program = await prisma.loyaltyProgram.findUnique({ where: { storeId } });
  return NextResponse.json(program);
}

export async function PUT(request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json();

  const program = await prisma.loyaltyProgram.upsert({
    where: { storeId },
    create: {
      storeId,
      pointsPerCurrencyUnit: body.pointsPerCurrencyUnit,
      redemptionRuleCents: body.redemptionRuleCents,
      active: body.active ?? true,
    },
    update: {
      pointsPerCurrencyUnit: body.pointsPerCurrencyUnit,
      redemptionRuleCents: body.redemptionRuleCents,
      active: body.active,
    },
  });

  return NextResponse.json(program);
}
