import { assertFeature, planGuard } from "@/lib/plans/enforce";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStoreRequestAuthorized } from "@/lib/menu/guard";
import { validateCouponInput } from "@/lib/marketing/validateCouponInput";

export async function GET(request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  {
    const blocked = await planGuard(() => assertFeature(storeId, "marketing"));
    if (blocked) return blocked;
  }

  const coupons = await prisma.coupon.findMany({ where: { storeId } });
  return NextResponse.json(coupons);
}

export async function POST(request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  {
    const blocked = await planGuard(() => assertFeature(storeId, "marketing"));
    if (blocked) return blocked;
  }

  const body = await request.json();

  const error = validateCouponInput(body, true);
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
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
