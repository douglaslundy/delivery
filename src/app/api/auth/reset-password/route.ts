import { NextResponse } from "next/server";
import { consumePasswordReset, MIN_PASSWORD } from "@/lib/auth/passwordReset";
import { clientIp, createRateLimiter } from "@/lib/storefront/rateLimit";

const allow = createRateLimiter(10, 15 * 60 * 1000);

export async function POST(request: Request) {
  if (!allow(clientIp(request))) return NextResponse.json({ error: "Muitas tentativas. Aguarde." }, { status: 429 });
  const body = (await request.json().catch(() => null)) as { token?: unknown; password?: unknown } | null;
  const token = typeof body?.token === "string" ? body.token : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (password.length < MIN_PASSWORD) {
    return NextResponse.json({ error: `A senha precisa ter ao menos ${MIN_PASSWORD} caracteres` }, { status: 400 });
  }
  if (!token || !(await consumePasswordReset(token, password))) {
    return NextResponse.json({ error: "Link invalido ou expirado" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
