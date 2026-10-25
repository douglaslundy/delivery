import { NextResponse } from "next/server";
import { createPasswordReset } from "@/lib/auth/passwordReset";
import { sendMail } from "@/lib/mail";
import { clientIp, createRateLimiter } from "@/lib/storefront/rateLimit";

const allow = createRateLimiter(5, 15 * 60 * 1000);

// Resposta identica exista a conta ou nao, para nao revelar e-mails cadastrados.
export async function POST(request: Request) {
  if (!allow(clientIp(request))) return NextResponse.json({ error: "Muitas tentativas. Aguarde." }, { status: 429 });
  const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email : "";
  if (email.includes("@")) {
    try {
      const token = await createPasswordReset(email);
      if (token) {
        const base = process.env.PUBLIC_APP_URL?.replace(/\/$/, "") ?? new URL(request.url).origin;
        await sendMail(email, "Redefinição de senha", `Para criar uma nova senha acesse (vale por 1 hora):\n${base}/redefinir-senha?token=${token}`);
      }
    } catch (error) {
      console.error("forgot-password falhou", error);
    }
  }
  return NextResponse.json({ ok: true });
}
