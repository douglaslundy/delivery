import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { denyUnlessPlatformAdmin } from "@/lib/admin/apiGuard";
import { STATUSES, deleteStore, isActiveStatus, resetOwnerPassword } from "@/lib/admin/stores";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await denyUnlessPlatformAdmin();
  if (denied) return denied;
  const { id } = await params;
  const body = await request.json();

  const data: Prisma.StoreUncheckedUpdateInput = {};
  if ("name" in body) {
    if (!body.name) return NextResponse.json({ error: "name vazio" }, { status: 400 });
    data.name = body.name;
  }
  if ("slug" in body) {
    if (!/^[a-z0-9-]+$/.test(body.slug ?? "")) return NextResponse.json({ error: "slug inválido" }, { status: 400 });
    data.slug = body.slug;
  }
  if ("foodCategory" in body) data.foodCategory = body.foodCategory || null;
  if ("planId" in body) data.planId = body.planId || null;
  if ("subscriptionStatus" in body) {
    if (!STATUSES.includes(body.subscriptionStatus)) return NextResponse.json({ error: "status inválido" }, { status: 400 });
    data.subscriptionStatus = body.subscriptionStatus;
    data.active = isActiveStatus(body.subscriptionStatus);
  }
  if (body.ownerPassword && String(body.ownerPassword).length < 8) {
    return NextResponse.json({ error: "senha deve ter ao menos 8 caracteres" }, { status: 400 });
  }

  try {
    const store = await prisma.store.update({ where: { id }, data });
    if (body.ownerPassword && !(await resetOwnerPassword(id, body.ownerPassword))) {
      return NextResponse.json({ error: "loja sem dono para redefinir senha" }, { status: 404 });
    }
    return NextResponse.json(store);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2025") return NextResponse.json({ error: "not found" }, { status: 404 });
      if (e.code === "P2002") return NextResponse.json({ error: "slug já existe" }, { status: 409 });
    }
    throw e;
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await denyUnlessPlatformAdmin();
  if (denied) return denied;
  const { id } = await params;
  try {
    await deleteStore(id);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    throw e;
  }
}
