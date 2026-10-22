import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ storeId: string; productId: string; addonId: string }> },
) {
  const { storeId, productId, addonId } = await params;
  const body = await request.json();

  const { count } = await prisma.productAddon.updateMany({
    where: { id: addonId, storeId, productId },
    data: body,
  });

  if (count === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const addon = await prisma.productAddon.findUnique({ where: { id: addonId } });
  return NextResponse.json(addon);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ storeId: string; productId: string; addonId: string }> },
) {
  const { storeId, productId, addonId } = await params;

  const { count } = await prisma.productAddon.deleteMany({
    where: { id: addonId, storeId, productId },
  });

  if (count === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
