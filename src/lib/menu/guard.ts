import { resolveStoreBySubdomain } from "@/lib/tenant";

export async function isStoreRequestAuthorized(request: Request, storeId: string): Promise<boolean> {
  const host = request.headers.get("host") ?? "";
  const store = await resolveStoreBySubdomain(host);
  return store !== null && store.id === storeId;
}
