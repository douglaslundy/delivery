import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/storefront/publicOrder";
import { resolvePublicStore } from "@/lib/storefront/publicStore";
import { clientIp, createRateLimiter } from "@/lib/storefront/rateLimit";

// Polling a cada 10s = 6/min por aba; 60/min por IP deixa folga sem permitir varredura de ids.
const allow = createRateLimiter(60, 60 * 1000);

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await resolvePublicStore(request);
  if ("response" in resolved) return resolved.response;
  const { store } = resolved;

  if (!allow(`${store.id}:${clientIp(request)}`)) {
    return NextResponse.json({ error: "Muitas consultas. Aguarde." }, { status: 429 });
  }

  const { id } = await params;
  const phone = normalizePhone(new URL(request.url).searchParams.get("phone"));
  // Id + telefone do pedido: sem o telefone certo a resposta e igual a "nao existe".
  const notFound = NextResponse.json({ error: "Pedido nao encontrado" }, { status: 404 });
  if (!phone) return notFound;

  const order = await prisma.order.findFirst({
    where: { id, storeId: store.id, customerId: phone },
    include: { items: true },
  });
  if (!order) return notFound;

  const products = await prisma.product.findMany({
    where: { storeId: store.id, id: { in: order.items.map((i) => i.productId) } },
    select: { id: true, name: true },
  });
  const names = new Map(products.map((p) => [p.id, p.name]));

  return NextResponse.json({
    id: order.id,
    status: order.status,
    createdAt: order.createdAt,
    pickup: (order.deliveryAddress as { pickup?: boolean } | null)?.pickup === true,
    paymentMethod: order.paymentMethod,
    subtotalCents: order.subtotalCents,
    discountCents: order.discountCents,
    deliveryFeeCents: order.deliveryFeeCents,
    totalCents: order.totalCents,
    estimatedDeliveryMinutes: store.estimatedDeliveryMinutes,
    items: order.items.map((i) => ({
      name: names.get(i.productId) ?? "Item",
      quantity: i.quantity,
      weightGrams: i.weightGrams,
      addons: (i.addons as { name: string }[]).map((a) => a.name),
      unitPriceCents: i.unitPriceCents,
    })),
  });
}
