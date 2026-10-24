import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isStoreRequestAuthorized } from "@/lib/menu/guard";

type Ctx = { params: Promise<{ storeId: string; customerId: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const { storeId, customerId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const data: { name?: string; phone?: string } = {};
  if (typeof body?.name === "string") {
    if (!body.name.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });
    data.name = body.name.trim();
  }
  if (typeof body?.phone === "string") {
    const phone = body.phone.replace(/\D/g, "");
    if (!phone) return NextResponse.json({ error: "phone is required" }, { status: 400 });
    data.phone = phone;
  }

  try {
    const { count } = await prisma.customer.updateMany({ where: { id: customerId, storeId }, data });
    if (count === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(await prisma.customer.findUniqueOrThrow({ where: { id: customerId } }));
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "já existe um cliente com esse telefone" }, { status: 409 });
    }
    throw e;
  }
}

export async function DELETE(request: Request, { params }: Ctx) {
  const { storeId, customerId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { count } = await prisma.customer.deleteMany({ where: { id: customerId, storeId } });
  if (count === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
