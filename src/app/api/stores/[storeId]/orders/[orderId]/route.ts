import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStoreRequestAuthorized } from "@/lib/menu/guard";

// So pedidos cancelados saem da base; itens e historico caem em cascata.
export async function DELETE(request: Request, { params }: { params: Promise<{ storeId: string; orderId: string }> }) {
  const { storeId, orderId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const order = await prisma.order.findFirst({ where: { id: orderId, storeId } });
  if (!order) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (order.status !== "CANCELED") {
    return NextResponse.json({ error: "Só é possível excluir pedidos cancelados." }, { status: 409 });
  }

  await prisma.order.delete({ where: { storeId_id: { storeId, id: orderId } } });
  return new NextResponse(null, { status: 204 });
}
