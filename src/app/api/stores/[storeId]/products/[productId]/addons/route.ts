import { NextResponse } from "next/server";
import { Prisma, type ProductAddon } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isStoreRequestAuthorized } from "@/lib/menu/guard";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ storeId: string; productId: string }> },
) {
  const { storeId, productId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const addons = await prisma.productAddon.findMany({
    where: { storeId, productId },
    orderBy: { position: "asc" },
  });

  const grouped = addons.reduce<Record<string, ProductAddon[]>>((acc, addon) => {
    (acc[addon.groupName] ??= []).push(addon);
    return acc;
  }, {});

  return NextResponse.json(grouped);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ storeId: string; productId: string }> },
) {
  const { storeId, productId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json();

  if (typeof body.groupName !== "string" || body.groupName.trim() === "") {
    return NextResponse.json({ error: "groupName is required" }, { status: 400 });
  }
  if (typeof body.name !== "string" || body.name.trim() === "") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const addon = await prisma.productAddon.create({
      data: {
        storeId,
        productId,
        groupName: body.groupName,
        name: body.name,
        priceCents: body.priceCents ?? 0,
        required: body.required ?? false,
        multiple: body.multiple ?? false,
        active: body.active ?? true,
      },
    });

    return NextResponse.json(addon, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json({ error: "product not found" }, { status: 404 });
    }
    throw error;
  }
}
