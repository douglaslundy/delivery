import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { startOfMonth } from "@/lib/plans/enforce";

const brl = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

async function Stats() {
  const [total, active, suspended, activePlans, orders] = await Promise.all([
    prisma.store.count(),
    prisma.store.count({ where: { subscriptionStatus: { in: ["ACTIVE", "TRIAL"] } } }),
    prisma.store.count({ where: { subscriptionStatus: { in: ["SUSPENDED", "CANCELED"] } } }),
    prisma.store.findMany({ where: { subscriptionStatus: "ACTIVE", planId: { not: null } }, select: { plan: { select: { priceCents: true } } } }),
    prisma.order.count({ where: { createdAt: { gte: startOfMonth() } } }),
  ]);
  const mrr = activePlans.reduce((sum, s) => sum + (s.plan?.priceCents ?? 0), 0);

  const stats = [
    ["Lojas", String(total), "cadastradas"],
    ["Ativas", String(active), "em operação ou teste"],
    ["Suspensas / canceladas", String(suspended), "bloqueadas"],
    ["Receita mensal recorrente", brl(mrr), "lojas ativas com plano"],
    ["Pedidos no mês", String(orders), "em toda a plataforma"],
  ];

  return (
    <div className="cards">
      {stats.map(([label, value, hint]) => (
        <div className="card" key={label}>
          <div className="label">{label}</div>
          <div className="value">{value}</div>
          <div className="hint">{hint}</div>
        </div>
      ))}
    </div>
  );
}

export default function AdminHome() {
  return (
    <main>
      <h1>Visão geral</h1>
      <p>Resumo de todos os estabelecimentos da plataforma.</p>
      <Suspense fallback={<p className="empty">Carregando...</p>}>
        <Stats />
      </Suspense>
    </main>
  );
}
