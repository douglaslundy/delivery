import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: { storeId: string } }) {
  const categories = await prisma.category.findMany({
    where: { storeId: params.storeId },
    orderBy: { position: "asc" },
  });

  return NextResponse.json(categories);
}

export async function POST(request: Request, { params }: { params: { storeId: string } }) {
  const body = await request.json();

  if (typeof body.name !== "string" || body.name.trim() === "") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const category = await prisma.category.create({
    data: { storeId: params.storeId, name: body.name },
  });

  return NextResponse.json(category, { status: 201 });
}
