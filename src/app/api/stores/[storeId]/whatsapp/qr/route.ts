import { assertFeature, planGuard } from "@/lib/plans/enforce";
import { NextResponse } from "next/server";
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

  const result = await callEvolution(storeId, (name) => `/instance/connect/${encodeURIComponent(name)}`);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  const data = result.data as { base64?: string; code?: string };
  return NextResponse.json({ base64: data.base64 ?? null, code: data.code ?? null });
}
