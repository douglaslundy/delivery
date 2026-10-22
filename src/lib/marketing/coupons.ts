import { prisma } from "@/lib/prisma";
import type { Coupon } from "@prisma/client";

export class CouponError extends Error {}

export async function validateAndPriceCoupon(
  storeId: string,
  code: string,
  subtotalCents: number,
): Promise<{ coupon: Coupon; discountCents: number }> {
  const coupon = await prisma.coupon.findUnique({ where: { storeId_code: { storeId, code } } });

  if (!coupon) throw new CouponError("coupon not found");
  if (!coupon.active) throw new CouponError("coupon is not active");
  if (coupon.expiresAt && coupon.expiresAt < new Date()) throw new CouponError("coupon has expired");
  if (coupon.usageLimit !== null && coupon.usageLimit <= 0) throw new CouponError("coupon usage limit reached");

  const discountCents =
    coupon.kind === "PERCENT"
      ? Math.round((subtotalCents * coupon.value) / 100)
      : Math.min(coupon.value, subtotalCents);

  return { coupon, discountCents };
}
