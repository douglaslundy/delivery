import { assertFeature, assertWithinPlan, planGuard } from "@/lib/plans/enforce";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStoreRequestAuthorized } from "@/lib/menu/guard";
import { createOrder } from "@/lib/orders/createOrder";

export async function GET(request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const orders = await prisma.order.findMany({
    where: {
      storeId,
      ...(status === "active" ? { status: { notIn: ["COMPLETED", "CANCELED"] } } : {}),
    },
    orderBy: { createdAt: "asc" },
    include: { items: true },
  });

  // OrderItem so guarda productId: resolve o nome do produto para as telas.
  const productIds = [...new Set(orders.flatMap((o) => o.items.map((i) => i.productId)))];
  const products = await prisma.product.findMany({ where: { storeId, id: { in: productIds } }, select: { id: true, name: true } });
  const names = new Map(products.map((p) => [p.id, p.name]));

  return NextResponse.json(
    orders.map((o) => ({ ...o, items: o.items.map((i) => ({ ...i, productName: names.get(i.productId) ?? "Produto removido" })) })),
  );
}

export async function POST(request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json();

  const blocked = await planGuard(async () => {
    await assertWithinPlan(storeId, "orders");
    if (body.channel === "SALAO") await assertFeature(storeId, "tables");
    if (body.channel === "PDV") await assertFeature(storeId, "pdv");
    if (body.channel === "DELIVERY") await assertFeature(storeId, "delivery");
  });
  if (blocked) return blocked;

  try {
    const order = await createOrder(storeId, body);
    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid order";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
