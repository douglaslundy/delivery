import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStoreRequestAuthorized } from "@/lib/menu/guard";

type Ctx = { params: Promise<{ storeId: string; personId: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const { storeId, personId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const data: { name?: string; phone?: string; active?: boolean } = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.phone === "string" && body.phone.trim()) data.phone = body.phone.trim();
  if (typeof body.active === "boolean") data.active = body.active;

  const { count } = await prisma.deliveryPerson.updateMany({ where: { id: personId, storeId }, data });
  if (count === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(await prisma.deliveryPerson.findUniqueOrThrow({ where: { id: personId } }));
}

export async function DELETE(request: Request, { params }: Ctx) {
  const { storeId, personId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Order.deliveryId nao tem FK: bloqueia manualmente para nao deixar pedidos orfaos.
  const inUse = await prisma.order.count({ where: { storeId, deliveryId: personId } });
  if (inUse > 0) {
    return NextResponse.json(
      { error: `Entregador vinculado a ${inUse} pedido(s). Desative-o em vez de excluir.` },
      { status: 409 },
    );
  }

  const { count } = await prisma.deliveryPerson.deleteMany({ where: { id: personId, storeId } });
  if (count === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
