import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isStoreRequestAuthorized } from "@/lib/menu/guard";
import { canTransition } from "@/lib/orders/stateMachine";
import { publishOrderEvent } from "@/lib/orders/publishOrderEvent";
import { recordOrderCompletion } from "@/lib/finance/recordOrderCompletion";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ storeId: string; orderId: string }> },
) {
  const { storeId, orderId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json();

  let order;
  try {
    order = await prisma.order.findUniqueOrThrow({ where: { storeId_id: { storeId, id: orderId } } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    throw error;
  }

  if (!canTransition(order.status, body.status, order.channel)) {
    return NextResponse.json({ error: "invalid transition" }, { status: 409 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const { count } = await tx.order.updateMany({
      where: { storeId, id: orderId, status: order.status },
      data: { status: body.status },
    });

    if (count === 0) {
      return null;
    }

    await tx.orderStatusEvent.create({
      data: { storeId, orderId, status: body.status },
    });

    const result = await tx.order.findUniqueOrThrow({ where: { storeId_id: { storeId, id: orderId } } });

    if (body.status === "COMPLETED") {
      await recordOrderCompletion(storeId, result, tx);
    }

    return result;
  });

  if (!updated) {
    return NextResponse.json({ error: "order status changed concurrently" }, { status: 409 });
  }

  publishOrderEvent(storeId, updated);

  return NextResponse.json(updated);
}
