import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptCredential } from "@/lib/crypto";
import { createEvolutionClient } from "@/lib/whatsapp/evolutionClient";
import { handleIncomingMessage } from "@/lib/whatsapp/bot";
import { parseIncomingWebhook } from "@/lib/whatsapp/parseWebhook";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function POST(request: Request) {
  const incoming = parseIncomingWebhook(await request.json().catch(() => null), request.headers.get("apikey"));
  // Evento ignorado (mensagem propria, grupo, status): confirma para a Evolution nao reenviar.
  if (!incoming) return NextResponse.json({ ok: true, ignored: true });

  const instance = await prisma.whatsappInstance.findUnique({
    where: { evolutionInstanceName: incoming.instanceName },
  });

  if (!instance || !safeEqual(incoming.apiKey ?? "", decryptCredential(instance.apiKeyEncrypted))) {
    return NextResponse.json({ error: "unknown instance" }, { status: 404 });
  }

  const client = createEvolutionClient(instance);
  try {
    await handleIncomingMessage(instance.storeId, incoming.from, incoming.text, client);
  } catch {
    // The webhook ack must not depend on the downstream reply succeeding.
  }

  return NextResponse.json({ ok: true });
}
