"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const ITEMS = [
  { path: "", label: "Início", ico: "🏠" },
  { path: "/pedidos", label: "Pedidos", ico: "🧾" },
  { path: "/kds", label: "KDS", ico: "👨‍🍳" },
  { path: "/mesas", label: "Mesas / PDV", ico: "🪑" },
  { path: "/menu", label: "Cardápio", ico: "🍔" },
  { path: "/categorias", label: "Categorias", ico: "🗂️" },
  { path: "/clientes", label: "Clientes", ico: "👥" },
  { path: "/equipe", label: "Equipe", ico: "🧑‍🤝‍🧑" },
  { path: "/whatsapp", label: "WhatsApp", ico: "💬" },
  { path: "/entregas", label: "Entregas", ico: "🛵" },
  { path: "/financeiro", label: "Financeiro", ico: "💰" },
  { path: "/marketing", label: "Marketing", ico: "📣" },
  { path: "/settings", label: "Configurações", ico: "⚙️" },
  { path: "/onboarding", label: "Onboarding", ico: "✅" },
];

export default function Nav({ store, locked = [] }: { store: string; locked?: string[] }) {
  const pathname = usePathname();
  return (
    <nav className="nav">
      {ITEMS.map((item) => {
        const href = `/${store}${item.path}`;
        const active = item.path === "" ? pathname === href : pathname.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined}>
            <span className="ico">{item.ico}</span>
            {item.label}
            {locked.includes(item.path) && <span className="lock" title="Indisponível no seu plano">🔒</span>}
          </Link>
        );
      })}
      <button type="button" className="nav-logout" onClick={() => signOut({ callbackUrl: "/login" })}>
        <span className="ico">🚪</span>
        Sair
      </button>
    </nav>
  );
}