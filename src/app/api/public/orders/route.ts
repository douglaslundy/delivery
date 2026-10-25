import { NextResponse } from "next/server";
import { CouponError } from "@/lib/marketing/coupons";
import { PricingError } from "@/lib/menu/pricing";
import { assertFeature, assertWithinPlan, planGuard } from "@/lib/plans/enforce";
import { sendOrderStatusNotification } from "@/lib/whatsapp/notifications";
import { createPublicOrder, parsePublicOrder, PublicOrderError } from "@/lib/storefront/publicOrder";
import { resolvePublicStore } from "@/lib/storefront/publicStore";
import { clientIp, createRateLimiter } from "@/lib/storefront/rateLimit";

// 5 pedidos por IP a cada 10 minutos.
const allow = createRateLimiter(5, 10 * 60 * 1000);

export async function POST(request: Request) {
  const resolved = await resolvePublicStore(request);
  if ("response" in resolved) return resolved.response;
  const { store } = resolved;

  if (!allow(`${store.id}:${clientIp(request)}`)) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);

  try {
    const parsed = parsePublicOrder(body);

    const blocked = await planGuard(async () => {
      await assertWithinPlan(store.id, "orders");
      if (!parsed.pickup) await assertFeature(store.id, "delivery");
    });
    if (blocked) return NextResponse.json({ error: "A loja nao esta aceitando pedidos no momento" }, { status: 403 });

    const order = await createPublicOrder(store, parsed);

    // Confirmacao por WhatsApp e best-effort: nao pode derrubar o pedido.
    sendOrderStatusNotification(store.id, order).catch(() => {});

    return NextResponse.json({ id: order.id, status: order.status, totalCents: order.totalCents }, { status: 201 });
  } catch (error) {
    if (error instanceof PublicOrderError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof CouponError) return NextResponse.json({ error: "Cupom invalido, expirado ou esgotado" }, { status: 400 });
    if (error instanceof PricingError) {
      return NextResponse.json({ error: `Revise as opcoes de um item: ${error.reason}` }, { status: 400 });
    }
    return NextResponse.json({ error: "Nao foi possivel criar o pedido" }, { status: 400 });
  }
}
