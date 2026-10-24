import { assertWithinPlan, planGuard } from "@/lib/plans/enforce";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStoreRequestAuthorized } from "@/lib/menu/guard";

export async function GET(request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const [customers, totals] = await Promise.all([
    prisma.customer.findMany({ where: { storeId }, orderBy: { createdAt: "desc" } }),
    prisma.order.groupBy({
      by: ["customerId"],
      where: { storeId, customerId: { not: null }, status: { not: "CANCELED" } },
      _count: { _all: true },
      _sum: { totalCents: true },
    }),
  ]);

  const byPhone = new Map(totals.map((t) => [t.customerId, t]));
  return NextResponse.json(
    customers.map((c) => ({
      ...c,
      orderCount: byPhone.get(c.phone)?._count._all ?? 0,
      totalCents: byPhone.get(c.phone)?._sum.totalCents ?? 0,
    })),
  );
}

export async function POST(request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.replace(/\D/g, "") : "";
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (phone.length < 8) return NextResponse.json({ error: "phone is invalid" }, { status: 400 });

  // Telefone ja cadastrado nao cria cliente novo, entao nao conta no limite.
  const existing = await prisma.customer.findUnique({ where: { storeId_phone: { storeId, phone } } });
  if (!existing) {
    const blocked = await planGuard(() => assertWithinPlan(storeId, "customers"));
    if (blocked) return blocked;
  }

  const customer = await prisma.customer.upsert({
    where: { storeId_phone: { storeId, phone } },
    create: { storeId, name, phone },
    update: { name },
  });
  return NextResponse.json(customer, { status: 201 });
}
