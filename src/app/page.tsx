import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";

export const dynamic = "force-dynamic";

async function Redirector(): Promise<never> {
  const session = await getServerSession(authOptions);
  const info = session as unknown as { storeId: string | null; isPlatformAdmin?: boolean } | null;
  if (info?.isPlatformAdmin) redirect("/admin");
  const storeId = info?.storeId;
  redirect(storeId ? `/${storeId}` : "/store-picker");
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <Redirector />
    </Suspense>
  );
}
