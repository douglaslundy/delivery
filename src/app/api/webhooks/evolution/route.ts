import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptCredential } from "@/lib/crypto";
import { createEvolutionClient } from "@/lib/whatsapp/evolutionClient";
import { handleIncomingMessage } from "@/lib/whatsapp/bot";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function POST(request: Request) {
  const body = await request.json();

  const instance = await prisma.whatsappInstance.findUnique({
    where: { evolutionInstanceName: body.evolutionInstanceName },
  });

  const providedKey = request.headers.get("apikey") ?? "";
  if (!instance || !safeEqual(providedKey, decryptCredential(instance.apiKeyEncrypted))) {
    return NextResponse.json({ error: "unknown instance" }, { status: 404 });
  }

  const client = createEvolutionClient(instance);
  try {
    await handleIncomingMessage(instance.storeId, body.from, body.text ?? "", client);
  } catch {
    // The webhook ack must not depend on the downstream reply succeeding.
  }

  return NextResponse.json({ ok: true });
}
