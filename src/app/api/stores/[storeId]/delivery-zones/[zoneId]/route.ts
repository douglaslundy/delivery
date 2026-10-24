import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStoreRequestAuthorized } from "@/lib/menu/guard";

type Ctx = { params: Promise<{ storeId: string; zoneId: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const { storeId, zoneId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const data: { name?: string; feeCents?: number } = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if ("feeCents" in body) {
    if (typeof body.feeCents !== "number" || !Number.isInteger(body.feeCents) || body.feeCents < 0) {
      return NextResponse.json({ error: "feeCents must be a non-negative integer" }, { status: 400 });
    }
    data.feeCents = body.feeCents;
  }

  const { count } = await prisma.deliveryZone.updateMany({ where: { id: zoneId, storeId }, data });
  if (count === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(await prisma.deliveryZone.findUniqueOrThrow({ where: { id: zoneId } }));
}

export async function DELETE(request: Request, { params }: Ctx) {
  const { storeId, zoneId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { count } = await prisma.deliveryZone.deleteMany({ where: { id: zoneId, storeId } });
  if (count === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
