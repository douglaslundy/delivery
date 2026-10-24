import { assertFeature, planGuard } from "@/lib/plans/enforce";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStoreRequestAuthorized } from "@/lib/menu/guard";

export async function PATCH(request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  {
    const blocked = await planGuard(() => assertFeature(storeId, "whatsappBot"));
    if (blocked) return blocked;
  }

  const body = await request.json().catch(() => ({}));
  const data: { botEnabled?: boolean; botGreeting?: string | null } = {};
  if ("botEnabled" in body) {
    if (typeof body.botEnabled !== "boolean") return NextResponse.json({ error: "botEnabled must be a boolean" }, { status: 400 });
    data.botEnabled = body.botEnabled;
  }
  if ("botGreeting" in body) {
    if (body.botGreeting !== null && typeof body.botGreeting !== "string") return NextResponse.json({ error: "botGreeting must be a string" }, { status: 400 });
    data.botGreeting = body.botGreeting?.trim() || null;
  }

  const exists = await prisma.whatsappInstance.findUnique({ where: { storeId }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "instancia nao configurada" }, { status: 404 });

  const instance = await prisma.whatsappInstance.update({
    where: { storeId },
    data,
    select: { botEnabled: true, botGreeting: true },
  });
  return NextResponse.json(instance);
}
