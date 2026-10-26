import { assertFeature, planGuard } from "@/lib/plans/enforce";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStoreRequestAuthorized } from "@/lib/menu/guard";
import { callEvolution } from "../evolution";

// Encerra a sessao do WhatsApp (logout); a instancia continua na Evolution e gera novo QR.
export async function POST(request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const blocked = await planGuard(() => assertFeature(storeId, "whatsappBot"));
  if (blocked) return blocked;

  const result = await callEvolution(storeId, (name) => `/instance/logout/${encodeURIComponent(name)}`, { method: "DELETE" });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  await prisma.whatsappInstance.update({ where: { storeId }, data: { connected: false } });
  return NextResponse.json({ ok: true });
}
