"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";

type Tracked = {
  id: string;
  status: string;
  pickup: boolean;
  paymentMethod: string | null;
  subtotalCents: number;
  discountCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  estimatedDeliveryMinutes: number | null;
  items: { name: string; quantity: number; weightGrams: number | null; addons: string[] }[];
};

const brl = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
const LABEL: Record<string, string> = {
  RECEIVED: "Pedido recebido",
  CONFIRMED: "Pedido confirmado",
  PREPARING: "Em preparo",
  READY: "Pronto",
  OUT_FOR_DELIVERY: "Saiu para entrega",
  DELIVERED: "Entregue",
  COMPLETED: "Concluído",
  CANCELED: "Cancelado",
};
const TERMINAL = ["DELIVERED", "COMPLETED", "CANCELED"];

export default function Tracker() {
  const { id } = useParams<{ id: string }>();
  const phone = useSearchParams().get("phone") ?? "";
  const [order, setOrder] = useState<Tracked | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;

    async function load() {
      try {
        const res = await fetch(`/api/public/orders/${id}?phone=${encodeURIComponent(phone)}`);
        if (res.status === 404) return setError("Pedido não encontrado. Confira o link.");
        if (res.ok) {
          const data: Tracked = await res.json();
          if (stop) return;
          setOrder(data);
          setError(null);
          if (TERMINAL.includes(data.status)) return;
        }
      } catch {}
      if (!stop) timer = setTimeout(load, 10000);
    }
    load();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [id, phone]);

  if (error) return <div className="shop"><p className="shop-empty">{error}</p><Link className="shop-link" href="/loja">Voltar ao cardápio</Link></div>;
  if (!order) return <div className="shop"><p className="shop-empty">Carregando pedido...</p></div>;

  return (
    <div className="shop">
      <header className="shop-header">
        <h1>{LABEL[order.status] ?? order.status}</h1>
        <p className="shop-muted">
          {order.pickup ? "Retirada no balcão" : "Entrega"}
          {order.estimatedDeliveryMinutes != null && !TERMINAL.includes(order.status) ? ` · previsão ${order.estimatedDeliveryMinutes} min` : ""}
        </p>
      </header>
      <div className="shop-list">
        <section className="shop-cat">
          <h2>Itens</h2>
          {order.items.map((i, n) => (
            <div key={n} className="shop-line">
              <span>
                {i.quantity}x {i.name}{i.weightGrams ? ` (${i.weightGrams} g)` : ""}
                {i.addons.length > 0 && <small> + {i.addons.join(", ")}</small>}
              </span>
            </div>
          ))}
          <div className="shop-summary">
            <div><span>Subtotal</span><span>{brl(order.subtotalCents)}</span></div>
            {order.discountCents > 0 && <div><span>Desconto</span><span>− {brl(order.discountCents)}</span></div>}
            {!order.pickup && <div><span>Entrega</span><span>{brl(order.deliveryFeeCents)}</span></div>}
            <div className="total"><span>Total</span><span>{brl(order.totalCents)}</span></div>
            {order.paymentMethod && <div><span>Pagamento</span><span>{order.paymentMethod}</span></div>}
          </div>
        </section>
        <Link className="shop-link" href="/loja">Fazer outro pedido</Link>
      </div>
    </div>
  );
}
