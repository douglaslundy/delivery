import { NextResponse } from "next/server";
import { CouponError, validateAndPriceCoupon } from "@/lib/marketing/coupons";
import { resolvePublicStore } from "@/lib/storefront/publicStore";
import { clientIp, createRateLimiter } from "@/lib/storefront/rateLimit";

// Limite apertado: impede adivinhar codigos de cupom.
const allow = createRateLimiter(10, 10 * 60 * 1000);

export async function POST(request: Request) {
  const resolved = await resolvePublicStore(request);
  if ("response" in resolved) return resolved.response;
  const { store } = resolved;

  if (!allow(`${store.id}:${clientIp(request)}`)) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code.trim().slice(0, 40) : "";
  const subtotalCents = Number(body?.subtotalCents);
  if (!code || !Number.isInteger(subtotalCents) || subtotalCents < 0) {
    return NextResponse.json({ error: "Dados invalidos" }, { status: 400 });
  }

  try {
    // Previa so para exibir o desconto; o valor real e recalculado no servidor ao criar o pedido.
    const { discountCents } = await validateAndPriceCoupon(store.id, code, subtotalCents);
    return NextResponse.json({ discountCents });
  } catch (error) {
    if (error instanceof CouponError) return NextResponse.json({ error: "Cupom invalido, expirado ou esgotado" }, { status: 400 });
    throw error;
  }
}
