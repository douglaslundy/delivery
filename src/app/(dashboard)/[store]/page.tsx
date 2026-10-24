import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getPlanUsage } from "@/lib/plans/usage";
import { RESOURCE_LABEL } from "@/lib/plans/labels";

const brl = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

const SHORTCUTS = [
  ["pedidos", "Pedidos", "Aceite ou recuse novos pedidos"],
  ["mesas", "Mesas e PDV", "Lance pedidos de salão e balcão"],
  ["clientes", "Clientes", "Cadastro e histórico"],
  ["whatsapp", "WhatsApp e Bot", "Conecte o número e o atendimento"],
  ["kds", "Cozinha (KDS)", "Acompanhe e avance os pedidos"],
  ["menu", "Cardápio", "Produtos, categorias e adicionais"],
  ["entregas", "Entregas", "Entregadores e zonas"],
  ["financeiro", "Financeiro", "Lançamentos e relatórios"],
  ["marketing", "Marketing", "Cupons, cashback e fidelidade"],
  ["settings", "Configurações", "Horários e estrutura"],
];

async function Stats({ params }: { params: Promise<{ store: string }> }) {
  const { store: storeId } = await params;
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const [orders, revenue, products, coupons, pending] = await Promise.all([
    prisma.order.count({ where: { storeId, createdAt: { gte: start } } }),
    prisma.order.aggregate({
      _sum: { totalCents: true },
      where: { storeId, createdAt: { gte: start }, status: { not: "CANCELED" } },
    }),
    prisma.product.count({ where: { storeId, active: true } }),
    prisma.coupon.count({ where: { storeId, active: true } }),
    prisma.order.count({ where: { storeId, status: "RECEIVED" } }),
  ]);

  const plan = await getPlanUsage(storeId);

  const stats = [
    ["Pedidos hoje", String(orders), "desde 00:00"],
    ["Faturamento hoje", brl(revenue._sum.totalCents ?? 0), "sem cancelados"],
    ["Produtos ativos", String(products), "no cardápio"],
    ["Cupons ativos", String(coupons), "em marketing"],
  ];

  return (
    <>
      <Link className="card" href={`/${storeId}/pedidos`} style={{ marginTop: 18, borderColor: pending > 0 ? "var(--primary)" : undefined }}>
        <div className="label">Pedidos aguardando aprovação</div>
        <div className="value">{pending}</div>
        <div className="hint">{pending > 0 ? "Clique para aceitar ou recusar" : "Nenhum pedido pendente"}</div>
      </Link>
      <div className="cards">
        {stats.map(([label, value, hint]) => (
          <div className="card" key={label}>
            <div className="label">{label}</div>
            <div className="value">{value}</div>
            <div className="hint">{hint}</div>
          </div>
        ))}
      </div>
      <h2 style={{ marginTop: 28 }}>Seu plano{plan.planName ? `: ${plan.planName}` : ""}</h2>
      {plan.hasPlan ? (
        <div className="cards">
          {plan.usage.map((u) => (
            <div className="card" key={u.resource}>
              <div className="label">{RESOURCE_LABEL[u.resource]}</div>
              <div className="value">
                {u.used} / {u.limit ?? "∞"}
              </div>
              <div className="hint">{u.limit != null && u.used >= u.limit ? "Limite atingido" : "em uso / limite"}</div>
            </div>
          ))}
        </div>
      ) : (
        <p className="hint">Sua loja não tem limites de plano.</p>
      )}
      <h2 style={{ marginTop: 28 }}>Atalhos</h2>
      <div className="cards">
        {SHORTCUTS.map(([path, title, hint]) => (
          <Link className="card" key={path} href={`/${storeId}/${path}`}>
            <div className="label">{title}</div>
            <div className="hint">{hint}</div>
          </Link>
        ))}
      </div>
    </>
  );
}

export default function StoreHomePage({ params }: { params: Promise<{ store: string }> }) {
  return (
    <main>
      <h1>Início</h1>
      <p>Resumo do dia da sua loja.</p>
      <Suspense fallback={<p className="empty">Carregando...</p>}>
        <Stats params={params} />
      </Suspense>
    </main>
  );
}
