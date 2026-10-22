import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStoreRequestAuthorized } from "@/lib/menu/guard";
import { validateCouponInput } from "@/lib/marketing/validateCouponInput";

const ALLOWED_FIELDS = ["active", "expiresAt", "usageLimit", "value"] as const;

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
  { params }: { params: Promise<{ storeId: string; couponId: string }> },
) {
  const { storeId, couponId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json();

  const existing = await prisma.coupon.findFirst({ where: { id: couponId, storeId } });
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const error = validateCouponInput(body, false, existing.kind);
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  const { count } = await prisma.coupon.updateMany({
    where: { id: couponId, storeId },
    data: pickAllowedFields(body),
  });

  if (count === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const coupon = await prisma.coupon.findUniqueOrThrow({ where: { id: couponId } });
  return NextResponse.json(coupon);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ storeId: string; couponId: string }> },
) {
  const { storeId, couponId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { count } = await prisma.coupon.deleteMany({ where: { id: couponId, storeId } });

  if (count === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
