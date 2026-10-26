import { assertFeature, planGuard } from "@/lib/plans/enforce";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStoreRequestAuthorized } from "@/lib/menu/guard";
import { callEvolution } from "../evolution";

export async function POST(request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const blocked = await planGuard(() => assertFeature(storeId, "whatsappBot"));
  if (blocked) return blocked;

  const result = await callEvolution(storeId, (name) => `/instance/restart/${encodeURIComponent(name)}`, { method: "POST" });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  // Depois de reiniciar o estado real volta pelo polling de /status.
  await prisma.whatsappInstance.update({ where: { storeId }, data: { connected: false } });
  return NextResponse.json({ ok: true });
}
