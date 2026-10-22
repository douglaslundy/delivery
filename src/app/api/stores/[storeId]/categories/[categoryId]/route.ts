import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ storeId: string; categoryId: string }> },
) {
  const { storeId, categoryId } = await params;
  const body = await request.json();

  try {
    const category = await prisma.category.update({
      where: { storeId_id: { storeId, id: categoryId } },
      data: body,
    });

    return NextResponse.json(category);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    throw error;
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ storeId: string; categoryId: string }> },
) {
  const { storeId, categoryId } = await params;

  try {
    await prisma.category.delete({
      where: { storeId_id: { storeId, id: categoryId } },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    throw error;
  }
}
