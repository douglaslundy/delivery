import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { denyUnlessPlatformAdmin } from "@/lib/admin/apiGuard";
import { validatePlan } from "@/lib/plans/validatePlan";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await denyUnlessPlatformAdmin();
  if (denied) return denied;
  const { id } = await params;
  const { data, error } = validatePlan(await request.json(), true);
  if (error) return NextResponse.json({ error }, { status: 400 });
  try {
    return NextResponse.json(await prisma.plan.update({ where: { id }, data: data as never }));
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    throw e;
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await denyUnlessPlatformAdmin();
  if (denied) return denied;
  const { id } = await params;
  const inUse = await prisma.store.count({ where: { planId: id } });
  if (inUse > 0) {
    return NextResponse.json({ error: `Plano em uso por ${inUse} loja(s). Troque o plano delas antes de excluir.` }, { status: 409 });
  }
  try {
    await prisma.plan.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    throw e;
  }
}
