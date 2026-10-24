"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const ITEMS = [
  { href: "/admin", label: "Visão geral", ico: "📊" },
  { href: "/admin/lojas", label: "Lojas", ico: "🏪" },
  { href: "/admin/planos", label: "Planos", ico: "💳" },
  { href: "/store-picker?lojas=1", label: "Abrir minhas lojas", ico: "↗️" },
];

export default function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="nav">
      {ITEMS.map((item) => {
        const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}>
            <span className="ico">{item.ico}</span>
            {item.label}
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
