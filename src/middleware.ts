import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { resolveStoreBySubdomain } from "@/lib/tenant";

export function evaluateTenantGuard({
  resolvedStoreId,
  sessionStoreIds,
}: {
  resolvedStoreId: string | null;
  sessionStoreIds: string[];
}): { allowed: boolean } {
  return { allowed: resolvedStoreId !== null && sessionStoreIds.includes(resolvedStoreId) };
}

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const store = await resolveStoreBySubdomain(host);

  if (!store) {
    return new NextResponse(null, { status: 404 });
  }

  const token = await getToken({ req: request });
  const sessionStoreIds = token?.sub
    ? ((token as unknown as { availableStoreIds?: string[] }).availableStoreIds ?? [])
    : [];

  const { allowed } = evaluateTenantGuard({ resolvedStoreId: store.id, sessionStoreIds });
  if (!allowed) {
    return new NextResponse(null, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/auth|login|onboarding|_next/static|_next/image|favicon.ico).*)"],
};
