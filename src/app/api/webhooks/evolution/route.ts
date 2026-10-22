import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createEvolutionClient } from "@/lib/whatsapp/evolutionClient";
import { handleIncomingMessage } from "@/lib/whatsapp/bot";

export async function POST(request: Request) {
  const body = await request.json();

  const instance = await prisma.whatsappInstance.findFirst({
    where: { evolutionInstanceName: body.evolutionInstanceName },
  });

  if (!instance) {
    return NextResponse.json({ error: "unknown instance" }, { status: 404 });
  }

  const client = createEvolutionClient(instance);
  await handleIncomingMessage(instance.storeId, body.from, body.text, client);

  return NextResponse.json({ ok: true });
}
