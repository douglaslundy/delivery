import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/team/rules";

// Papel do usuario logado na loja (ou null). Admin da plataforma conta como OWNER.
export async function getActorRole(storeId: string): Promise<Role | null> {
  const session = (await getServerSession(authOptions)) as { accountId?: string | null; isPlatformAdmin?: boolean } | null;
  if (!session) return null;
  if (session.isPlatformAdmin) return "OWNER";
  if (!session.accountId) return null;
  const member = await prisma.storeMember.findUnique({
    where: { accountId_storeId: { accountId: session.accountId, storeId } },
  });
  return member?.role ?? null;
}
