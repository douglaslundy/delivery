import { Suspense } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function StorePickerContent({ searchParams }: { searchParams: Promise<{ lojas?: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  const { storeId, availableStoreIds, isPlatformAdmin } = session as unknown as {
    storeId: string | null;
    availableStoreIds: string[];
    isPlatformAdmin?: boolean;
  };
  // Admin da plataforma cai no /admin; ?lojas=1 e o link "Abrir minhas lojas".
  if (isPlatformAdmin && !(await searchParams).lojas) redirect("/admin");

  const host = (await headers()).get("host") ?? "";
  const [hostname, port] = host.split(":");
  const origin = (slug: string) => `${protocol}://${slug}.${rootDomain}${port ? `:${port}` : ""}`;
  const rootDomain = hostname.split(".").slice(1).join(".") || hostname;
  const protocol = hostname === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(hostname) ? "http" : "https";

  if (storeId) {
    const store = await prisma.store.findUniqueOrThrow({ where: { id: storeId } });
    redirect(origin(store.slug));
  }

  if (availableStoreIds.length === 0) {
    return (
      <div className="auth">
        <div className="auth-card">
          <div className="brand"><span className="brand-mark">🛵</span>Delivery</div>
          <h1>Acesso negado</h1>
          <p className="sub">Sua conta nao esta vinculada a nenhuma loja.</p>
        </div>
      </div>
    );
  }

  const stores = await prisma.store.findMany({ where: { id: { in: availableStoreIds } } });

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="brand"><span className="brand-mark">🛵</span>Delivery</div>
        <h1>Selecione uma loja</h1>
        <p className="sub">Escolha qual loja deseja gerenciar.</p>
        <ul>
          {stores.map((store) => (
            <li key={store.id}>
              <a href={origin(store.slug)}>{store.name}</a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function StorePickerPage({ searchParams }: { searchParams: Promise<{ lojas?: string }> }) {
  return (
    <Suspense fallback={<p className="empty">Carregando...</p>}>
      <StorePickerContent searchParams={searchParams} />
    </Suspense>
  );
}
