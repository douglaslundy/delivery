import { NextResponse } from "next/server";
import type { ProductAddon } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: { storeId: string; productId: string } },
) {
  const addons = await prisma.productAddon.findMany({
    where: { storeId: params.storeId, productId: params.productId },
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
  { params }: { params: { storeId: string; productId: string } },
) {
  const body = await request.json();

  if (typeof body.groupName !== "string" || body.groupName.trim() === "") {
    return NextResponse.json({ error: "groupName is required" }, { status: 400 });
  }
  if (typeof body.name !== "string" || body.name.trim() === "") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const addon = await prisma.productAddon.create({
    data: {
      storeId: params.storeId,
      productId: params.productId,
      groupName: body.groupName,
      name: body.name,
      priceCents: body.priceCents ?? 0,
      required: body.required ?? false,
      multiple: body.multiple ?? false,
    },
  });

  return NextResponse.json(addon, { status: 201 });
}
