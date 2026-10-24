import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStoreRequestAuthorized } from "@/lib/menu/guard";
import { assertFeature, planGuard } from "@/lib/plans/enforce";

type Ctx = { params: Promise<{ storeId: string; categoryId: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const { storeId, categoryId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const blocked = await planGuard(() => assertFeature(storeId, "finance"));
  if (blocked) return blocked;

  const body = await request.json().catch(() => ({}));
  const data: { name?: string; kind?: string } = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.kind === "string" && body.kind.trim()) data.kind = body.kind;

  const { count } = await prisma.financeCategory.updateMany({ where: { id: categoryId, storeId }, data });
  if (count === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(await prisma.financeCategory.findUniqueOrThrow({ where: { id: categoryId } }));
}

export async function DELETE(request: Request, { params }: Ctx) {
  const { storeId, categoryId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const blocked = await planGuard(() => assertFeature(storeId, "finance"));
  if (blocked) return blocked;

  const inUse = await prisma.financeEntry.count({ where: { storeId, categoryId } });
  if (inUse > 0) {
    return NextResponse.json({ error: `Categoria usada em ${inUse} lançamento(s). Altere-os antes de excluir.` }, { status: 409 });
  }

  const { count } = await prisma.financeCategory.deleteMany({ where: { id: categoryId, storeId } });
  if (count === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
