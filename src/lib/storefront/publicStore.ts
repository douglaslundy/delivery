import { NextResponse } from "next/server";
import type { Store } from "@prisma/client";
import { resolveStoreBySubdomain } from "@/lib/tenant";

// Toda rota publica resolve a loja pelo host; sem loja = 404. Nunca aceita storeId do cliente.
export async function resolvePublicStore(request: Request): Promise<{ store: Store } | { response: NextResponse }> {
  const store = await resolveStoreBySubdomain(request.headers.get("host") ?? "");
  if (!store) return { response: NextResponse.json({ error: "store not found" }, { status: 404 }) };
  return { store };
}
