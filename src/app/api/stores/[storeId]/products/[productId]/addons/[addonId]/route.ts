import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: { storeId: string; productId: string; addonId: string } },
) {
  const body = await request.json();

  const { count } = await prisma.productAddon.updateMany({
    where: { id: params.addonId, storeId: params.storeId, productId: params.productId },
    data: body,
  });

  if (count === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const addon = await prisma.productAddon.findUnique({ where: { id: params.addonId } });
  return NextResponse.json(addon);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { storeId: string; productId: string; addonId: string } },
) {
  const { count } = await prisma.productAddon.deleteMany({
    where: { id: params.addonId, storeId: params.storeId, productId: params.productId },
  });

  if (count === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
