import type { Store } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function resolveStoreBySubdomain(host: string): Promise<Store | null> {
  const hostname = host.split(":")[0];
  const slug = hostname.split(".")[0];

  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store || !store.active) {
    return null;
  }

  return store;
}
