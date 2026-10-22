import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: { storeId: string; productId: string } },
) {
  const body = await request.json();

  if ("priceCents" in body && (typeof body.priceCents !== "number" || !Number.isInteger(body.priceCents) || body.priceCents <= 0)) {
    return NextResponse.json({ error: "priceCents must be a positive integer" }, { status: 400 });
  }

  try {
    const product = await prisma.product.update({
      where: { storeId_id: { storeId: params.storeId, id: params.productId } },
      data: body,
    });

    return NextResponse.json(product);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    throw error;
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { storeId: string; productId: string } },
) {
  try {
    await prisma.product.delete({
      where: { storeId_id: { storeId: params.storeId, id: params.productId } },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    throw error;
  }
}
