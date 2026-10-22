import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStoreRequestAuthorized } from "@/lib/menu/guard";

export async function GET(request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const coupons = await prisma.coupon.findMany({ where: { storeId } });
  return NextResponse.json(coupons);
}

export async function POST(request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json();

  if (body.kind !== "PERCENT" && body.kind !== "FIXED") {
    return NextResponse.json({ error: "kind must be PERCENT or FIXED" }, { status: 400 });
  }

  const coupon = await prisma.coupon.create({
    data: {
      storeId,
      code: body.code,
      kind: body.kind,
      value: body.value,
      expiresAt: body.expiresAt ?? null,
      usageLimit: body.usageLimit ?? null,
    },
  });

  return NextResponse.json(coupon, { status: 201 });
}
