import { assertFeature, planGuard } from "@/lib/plans/enforce";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStoreRequestAuthorized } from "@/lib/menu/guard";
import { callEvolution } from "../evolution";

export async function GET(request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  {
    const blocked = await planGuard(() => assertFeature(storeId, "whatsappBot"));
    if (blocked) return blocked;
  }

  const result = await callEvolution(storeId, (name) => `/instance/connectionState/${encodeURIComponent(name)}`);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  const state = (result.data as { instance?: { state?: string } }).instance?.state ?? "unknown";
  const connected = state === "open";
  await prisma.whatsappInstance.update({ where: { storeId }, data: { connected } });
  return NextResponse.json({ state, connected });
}
