import { Prisma, type Order } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calculateItemPrice, type LineItemSelection } from "@/lib/menu/pricing";
import { validateAndPriceCoupon, CouponError } from "@/lib/marketing/coupons";

export type CreateOrderInput = {
  channel: "PDV" | "SALAO" | "DELIVERY" | "AGENDADO";
  tableNumber?: string;
  scheduledFor?: Date;
  customerId?: string;
  deliveryAddress?: Record<string, unknown>;
  items: LineItemSelection[];
  couponCode?: string;
  paymentMethod?: string;
};

export async function createOrder(storeId: string, input: CreateOrderInput): Promise<Order> {
  if (input.channel === "SALAO" && !input.tableNumber) {
    throw new Error("tableNumber is required for a SALAO order");
  }
  if (input.channel === "AGENDADO" && !input.scheduledFor) {
    throw new Error("scheduledFor is required for an AGENDADO order");
  }
  if (input.channel === "DELIVERY" && !input.deliveryAddress) {
    throw new Error("deliveryAddress is required for a DELIVERY order");
  }

  const pricedItems = await Promise.all(
    input.items.map(async (item) => {
      const product = await prisma.product.findUniqueOrThrow({
        where: { storeId_id: { storeId, id: item.productId } },
      });
      const addons = await prisma.productAddon.findMany({
        where: { storeId, productId: item.productId },
      });

      if (product.pricePerKg && item.quantity !== 1) {
        throw new Error("per-kg items must have quantity 1; adjust weightGrams instead");
      }

      const selectedAddons = addons.filter((a) => a.active && item.selectedAddonIds.includes(a.id));
      const unitPriceCents = calculateItemPrice(product, addons, item) / item.quantity;

      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPriceCents,
        weightGrams: item.weightGrams,
        addons: selectedAddons.map((a) => ({ id: a.id, name: a.name, priceCents: a.priceCents })),
      };
    }),
  );

  const subtotalCents = pricedItems.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);

  return prisma.$transaction(async (tx) => {
    let discountCents = 0;
    let couponId: string | undefined;

    if (input.couponCode) {
      const { coupon, discountCents: priced } = await validateAndPriceCoupon(storeId, input.couponCode, subtotalCents, tx);
      discountCents = priced;
      couponId = coupon.id;

      if (coupon.usageLimit !== null) {
        const { count } = await tx.coupon.updateMany({
          where: { id: coupon.id, usageLimit: { gt: 0 } },
          data: { usageLimit: { decrement: 1 } },
        });
        if (count === 0) {
          throw new CouponError("coupon usage limit reached");
        }
      }
    }

    const order = await tx.order.create({
      data: {
        storeId,
        channel: input.channel,
        tableNumber: input.tableNumber,
        scheduledFor: input.scheduledFor,
        customerId: input.customerId,
        deliveryAddress: input.deliveryAddress as Prisma.InputJsonValue | undefined,
        paymentMethod: input.paymentMethod,
        subtotalCents,
        discountCents,
        couponId,
        totalCents: subtotalCents - discountCents,
        items: { create: pricedItems },
      },
    });

    await tx.orderStatusEvent.create({
      data: { storeId, orderId: order.id, status: "RECEIVED" },
    });

    return order;
  });
}
