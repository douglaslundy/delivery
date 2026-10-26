import { assertFeature, planGuard } from "@/lib/plans/enforce";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStoreRequestAuthorized } from "@/lib/menu/guard";
import { encryptCredential } from "@/lib/crypto";
import { markStepDone } from "@/lib/onboarding/progress";
import { callEvolution } from "./evolution";

export async function GET(request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  {
    const blocked = await planGuard(() => assertFeature(storeId, "whatsappBot"));
    if (blocked) return blocked;
  }

  const instance = await prisma.whatsappInstance.findUnique({
    where: { storeId },
    select: { id: true, storeId: true, evolutionInstanceName: true, evolutionApiUrl: true, phoneNumber: true, connected: true, botEnabled: true, botGreeting: true },
  });
  return NextResponse.json(instance);
}

export async function POST(request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  {
    const blocked = await planGuard(() => assertFeature(storeId, "whatsappBot"));
    if (blocked) return blocked;
  }

  const body = await request.json();

  const instance = await prisma.whatsappInstance.upsert({
    where: { storeId },
    create: {
      storeId,
      evolutionInstanceName: body.evolutionInstanceName,
      evolutionApiUrl: body.evolutionApiUrl,
      apiKeyEncrypted: encryptCredential(body.apiKey),
    },
    update: {
      evolutionInstanceName: body.evolutionInstanceName,
      evolutionApiUrl: body.evolutionApiUrl,
      apiKeyEncrypted: encryptCredential(body.apiKey),
    },
    select: { id: true, storeId: true, evolutionInstanceName: true, evolutionApiUrl: true, phoneNumber: true, connected: true, botEnabled: true, botGreeting: true },
  });

  await markStepDone(storeId, "step5BotDone");

  return NextResponse.json(instance, { status: 201 });
}

// Exclui a instancia na Evolution e o registro local. ?local=1 remove so o registro (Evolution fora do ar).
export async function DELETE(request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const blocked = await planGuard(() => assertFeature(storeId, "whatsappBot"));
  if (blocked) return blocked;

  const instance = await prisma.whatsappInstance.findUnique({ where: { storeId } });
  if (!instance) return NextResponse.json({ error: "instancia nao configurada" }, { status: 404 });

  if (new URL(request.url).searchParams.get("local") !== "1") {
    // A Evolution ja recusou delete (400) logo apos restart; encerrar a sessao antes e best-effort, falha ignorada.
    await callEvolution(storeId, (name) => `/instance/logout/${encodeURIComponent(name)}`, { method: "DELETE" });
    const result = await callEvolution(storeId, (name) => `/instance/delete/${encodeURIComponent(name)}`, { method: "DELETE" });
    // Instancia que ja nao existe na Evolution nao impede a limpeza local.
    if (!result.ok && !/ 404|not found/i.test(result.error)) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
  }
  await prisma.whatsappInstance.delete({ where: { storeId } });
  return NextResponse.json({ ok: true });
}
