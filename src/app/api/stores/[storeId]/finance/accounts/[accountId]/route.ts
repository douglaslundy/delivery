import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStoreRequestAuthorized } from "@/lib/menu/guard";
import { assertFeature, planGuard } from "@/lib/plans/enforce";

type Ctx = { params: Promise<{ storeId: string; accountId: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const { storeId, accountId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const blocked = await planGuard(() => assertFeature(storeId, "finance"));
  if (blocked) return blocked;

  const body = await request.json().catch(() => ({}));
  const data: { name?: string; initialBalanceCents?: number } = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if ("initialBalanceCents" in body) {
    if (typeof body.initialBalanceCents !== "number" || !Number.isInteger(body.initialBalanceCents)) {
      return NextResponse.json({ error: "initialBalanceCents must be an integer" }, { status: 400 });
    }
    data.initialBalanceCents = body.initialBalanceCents;
  }

  const { count } = await prisma.bankAccount.updateMany({ where: { id: accountId, storeId }, data });
  if (count === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(await prisma.bankAccount.findUniqueOrThrow({ where: { id: accountId } }));
}

export async function DELETE(request: Request, { params }: Ctx) {
  const { storeId, accountId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const blocked = await planGuard(() => assertFeature(storeId, "finance"));
  if (blocked) return blocked;

  const inUse = await prisma.financeEntry.count({ where: { storeId, bankAccountId: accountId } });
  if (inUse > 0) {
    return NextResponse.json({ error: `Conta com ${inUse} lançamento(s). Exclua ou mova os lançamentos antes.` }, { status: 409 });
  }

  const { count } = await prisma.bankAccount.deleteMany({ where: { id: accountId, storeId } });
  if (count === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
