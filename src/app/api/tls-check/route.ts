import { NextResponse } from "next/server";
import { resolveStoreBySubdomain } from "@/lib/tenant";

// Caddy's on_demand_tls "ask" endpoint: called before issuing a certificate for
// a host it hasn't seen yet. 200 = issue it, non-2xx = refuse.
export async function GET(request: Request) {
  const domain = new URL(request.url).searchParams.get("domain") ?? "";
  const store = await resolveStoreBySubdomain(domain);

  if (!store) {
    return NextResponse.json({ error: "unknown domain" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
