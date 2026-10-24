import { assertFeature, planGuard } from "@/lib/plans/enforce";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStoreRequestAuthorized } from "@/lib/menu/guard";
import { encryptCredential } from "@/lib/crypto";
import { markStepDone } from "@/lib/onboarding/progress";
import { callEvolutionRaw } from "../evolution";

export async function POST(request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  {
    const blocked = await planGuard(() => assertFeature(storeId, "whatsappBot"));
    if (blocked) return blocked;
  }

  const body = await request.json().catch(() => null);
  const { evolutionInstanceName, evolutionApiUrl, apiKey } = body ?? {};
  if (![evolutionInstanceName, evolutionApiUrl, apiKey].every((v) => typeof v === "string" && v.trim())) {
    return NextResponse.json({ error: "URL, API key e nome da instancia sao obrigatorios" }, { status: 400 });
  }

  // Sem URL publica a Evolution nao alcanca o app: so avisamos, o envio continua funcionando.
  const publicUrl = process.env.PUBLIC_APP_URL?.replace(/\/$/, "");
  const webhook = publicUrl
    ? {
        enabled: true,
        url: `${publicUrl}/api/webhooks/evolution`,
        byEvents: false,
        base64: false,
        headers: { apikey: apiKey },
        events: ["MESSAGES_UPSERT"],
      }
    : null;

  const created = await callEvolutionRaw(evolutionApiUrl, apiKey, "/instance/create", {
    method: "POST",
    body: { instanceName: evolutionInstanceName, qrcode: true, integration: "WHATSAPP-BAILEYS", ...(webhook && { webhook }) },
  });
  // Instancia ja existente na Evolution nao e erro: so conectamos nela.
  const alreadyExists = !created.ok && /already|in use|exist/i.test(created.error);
  if (!created.ok && !alreadyExists) {
    return NextResponse.json({ error: created.error }, { status: created.status });
  }

  const instance = await prisma.whatsappInstance.upsert({
    where: { storeId },
    create: { storeId, evolutionInstanceName, evolutionApiUrl, apiKeyEncrypted: encryptCredential(apiKey) },
    update: { evolutionInstanceName, evolutionApiUrl, apiKeyEncrypted: encryptCredential(apiKey) },
    select: { id: true, evolutionInstanceName: true, evolutionApiUrl: true, connected: true, botEnabled: true, botGreeting: true },
  });
  await markStepDone(storeId, "step5BotDone");

  let webhookWarning: string | null = null;
  if (!webhook) {
    webhookWarning = "PUBLIC_APP_URL nao configurada: o recebimento de mensagens (bot) exige URL publica; o envio funciona.";
  } else if (alreadyExists) {
    // Instancia ja existia: o body do create foi ignorado, entao aplica o webhook por fora.
    const set = await callEvolutionRaw(evolutionApiUrl, apiKey, `/webhook/set/${encodeURIComponent(evolutionInstanceName)}`, {
      method: "POST",
      body: { webhook },
    });
    if (!set.ok) webhookWarning = `Nao foi possivel configurar o webhook: ${set.error}`;
  }

  return NextResponse.json({ ...instance, webhookWarning }, { status: 201 });
}
