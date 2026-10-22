import type { Coupon, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export class CouponError extends Error {}

type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient;

export async function validateAndPriceCoupon(
  storeId: string,
  code: string,
  subtotalCents: number,
  client: PrismaClientOrTx = prisma,
): Promise<{ coupon: Coupon; discountCents: number }> {
  const coupon = await client.coupon.findUnique({ where: { storeId_code: { storeId, code } } });

  if (!coupon) throw new CouponError("coupon not found");
  if (!coupon.active) throw new CouponError("coupon is not active");
  if (coupon.expiresAt && coupon.expiresAt < new Date()) throw new CouponError("coupon has expired");
  if (coupon.usageLimit !== null && coupon.usageLimit <= 0) throw new CouponError("coupon usage limit reached");

  const rawDiscountCents = coupon.kind === "PERCENT" ? Math.round((subtotalCents * coupon.value) / 100) : coupon.value;
  const discountCents = Math.min(rawDiscountCents, subtotalCents);

  return { coupon, discountCents };
}
