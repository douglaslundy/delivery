import { Suspense, type ReactNode } from "react";
import { requirePlatformAdmin } from "@/lib/admin/guard";
import BackButton from "@/components/back-button";
import AdminNav from "./nav";

export const dynamic = "force-dynamic";

async function Shell({ children }: { children: ReactNode }) {
  await requirePlatformAdmin();
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">🛵</span>
          Plataforma
        </div>
        <AdminNav />
        <div className="sidebar-foot">Administração da plataforma</div>
      </aside>
      <div className="shell-main">
        <div className="topbar">
          <BackButton fallback="/admin" />
        </div>
        {children}
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
