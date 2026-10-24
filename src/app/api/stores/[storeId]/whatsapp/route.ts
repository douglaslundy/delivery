import { assertFeature, planGuard } from "@/lib/plans/enforce";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStoreRequestAuthorized } from "@/lib/menu/guard";
import { encryptCredential } from "@/lib/crypto";
import { markStepDone } from "@/lib/onboarding/progress";

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
