import { Suspense } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";

async function StorePickerContent() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  const { storeId, availableStoreIds } = session as unknown as {
    storeId: string | null;
    availableStoreIds: string[];
  };

  const host = (await headers()).get("host") ?? "";
  const hostname = host.split(":")[0];
  const rootDomain = hostname.split(".").slice(1).join(".") || hostname;
  const protocol = hostname === "localhost" || hostname.startsWith("127.") ? "http" : "https";

  if (storeId) {
    const store = await prisma.store.findUniqueOrThrow({ where: { id: storeId } });
    redirect(`${protocol}://${store.slug}.${rootDomain}`);
  }

  if (availableStoreIds.length === 0) {
    return (
      <main>
        <h1>Acesso negado</h1>
        <p>Sua conta nao esta vinculada a nenhuma loja.</p>
      </main>
    );
  }

  const stores = await prisma.store.findMany({ where: { id: { in: availableStoreIds } } });

  return (
    <main>
      <h1>Selecione uma loja</h1>
      <ul>
        {stores.map((store) => (
          <li key={store.id}>
            <a href={`${protocol}://${store.slug}.${rootDomain}`}>{store.name}</a>
          </li>
        ))}
      </ul>
    </main>
  );
}

export default function StorePickerPage() {
  return (
    <Suspense fallback={<p>Carregando...</p>}>
      <StorePickerContent />
    </Suspense>
  );
}
