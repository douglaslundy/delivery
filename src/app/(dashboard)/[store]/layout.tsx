import { Suspense, type ReactNode } from "react";
import BackButton from "@/components/back-button";
import { featureEnabled, getPlanUsage } from "@/lib/plans/usage";
import Nav from "./nav";

async function Shell({ params, children }: { params: Promise<{ store: string }>; children: ReactNode }) {
  const { store } = await params;
  const usage = await getPlanUsage(store);
  const locked: string[] = [];
  if (!featureEnabled(usage, "finance")) locked.push("/financeiro");
  if (!featureEnabled(usage, "marketing")) locked.push("/marketing");
  if (!featureEnabled(usage, "whatsappBot")) locked.push("/whatsapp");
  if (!featureEnabled(usage, "delivery")) locked.push("/entregas");
  if (!featureEnabled(usage, "tables") && !featureEnabled(usage, "pdv")) locked.push("/mesas");

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">🛵</span>
          Delivery
        </div>
        <Nav store={store} locked={locked} />
        <div className="sidebar-foot">{usage.planName ? `Plano ${usage.planName}` : "Painel da loja"}</div>
      </aside>
      <div className="shell-main">
        <div className="topbar">
          <BackButton fallback={`/${store}`} />
        </div>
        {children}
      </div>
    </div>
  );
}

export default function StoreLayout({
  params,
  children,
}: {
  params: Promise<{ store: string }>;
  children: ReactNode;
}) {
  return (
    <Suspense fallback={null}>
      <Shell params={params}>{children}</Shell>
    </Suspense>
  );
}
