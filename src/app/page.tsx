import { Suspense } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { resolveStoreBySubdomain } from "@/lib/tenant";

export const dynamic = "force-dynamic";

async function Redirector(): Promise<never> {
  const session = await getServerSession(authOptions);
  const info = session as unknown as { storeId: string | null; isPlatformAdmin?: boolean } | null;
  if (info?.isPlatformAdmin) redirect("/admin");
  if (info?.storeId) redirect(`/${info.storeId}`);
  if (info) redirect("/store-picker");
  // Visitante sem sessao num host de loja ve o cardapio publico.
  const store = await resolveStoreBySubdomain((await headers()).get("host") ?? "");
  redirect(store ? "/loja" : "/login");
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <Redirector />
    </Suspense>
  );
}
