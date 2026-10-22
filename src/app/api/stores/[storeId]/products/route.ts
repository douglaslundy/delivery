import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStoreRequestAuthorized } from "@/lib/menu/guard";

export async function GET(request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const active = searchParams.get("active");

  const products = await prisma.product.findMany({
    where: {
      storeId,
      ...(active === "true" ? { active: true } : {}),
    },
    orderBy: { position: "asc" },
  });

  return NextResponse.json(products);
}

export async function POST(request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json();

  if (typeof body.name !== "string" || body.name.trim() === "") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  if (typeof body.priceCents !== "number" || !Number.isInteger(body.priceCents) || body.priceCents <= 0) {
    return NextResponse.json({ error: "priceCents must be a positive integer" }, { status: 400 });
  }

  const product = await prisma.product.create({
    data: {
      storeId,
      name: body.name,
      categoryId: body.categoryId ?? null,
      description: body.description ?? "",
      priceCents: body.priceCents,
      pricePerKg: body.pricePerKg ?? false,
    },
  });

  return NextResponse.json(product, { status: 201 });
}
