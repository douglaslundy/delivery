import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStoreRequestAuthorized } from "@/lib/menu/guard";

const ALLOWED_FIELDS = ["groupName", "name", "priceCents", "required", "multiple", "active", "position"] as const;

function pickAllowedFields(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in body) {
      data[field] = body[field];
    }
  }
  return data;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ storeId: string; productId: string; addonId: string }> },
) {
  const { storeId, productId, addonId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json();

  const { count } = await prisma.productAddon.updateMany({
    where: { id: addonId, storeId, productId },
    data: pickAllowedFields(body),
  });

  if (count === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const addon = await prisma.productAddon.findUnique({ where: { id: addonId } });
  return NextResponse.json(addon);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ storeId: string; productId: string; addonId: string }> },
) {
  const { storeId, productId, addonId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { count } = await prisma.productAddon.deleteMany({
    where: { id: addonId, storeId, productId },
  });

  if (count === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
