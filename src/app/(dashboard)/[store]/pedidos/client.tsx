"use client";

import { useCallback, useEffect, useState } from "react";
import OrderItems, { type OrderLine } from "@/components/order-items";
import { useParams } from "next/navigation";
import { Feedback, useAction } from "../feedback";

type Order = {
  id: string;
  status: string;
  channel: string;
  tableNumber: string | null;
  customerId: string | null;
  totalCents: number;
  createdAt: string;
  items?: OrderLine[];
};

const brl = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
const CLOSED = ["COMPLETED", "CANCELED", "DELIVERED"];
const TABS = [
  ["pending", "Aguardando aprovação"],
  ["active", "Em andamento"],
  ["done", "Finalizados"],
] as const;

export default function PedidosClient() {
  const { store: storeId } = useParams<{ store: string }>();
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("pending");
  const { busy, msg, run } = useAction();

  const load = useCallback(async () => {
    const res = await fetch(`/api/stores/${storeId}/orders`);
    if (res.ok) setOrders(await res.json());
  }, [storeId]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [load]);

  const groups = {
    pending: orders.filter((o) => o.status === "RECEIVED"),
    active: orders.filter((o) => o.status !== "RECEIVED" && !CLOSED.includes(o.status)),
    done: orders.filter((o) => CLOSED.includes(o.status)).reverse(),
  };

  async function decide(order: Order, status: "CONFIRMED" | "CANCELED") {
    const ok = await run(
      () => fetch(`/api/stores/${storeId}/orders/${order.id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
      status === "CONFIRMED" ? "Pedido aceito!" : "Pedido recusado.",
    );
    if (ok) load();
  }

  async function removeOrder(order: Order) {
    if (!window.confirm("Excluir este pedido cancelado? Não pode ser desfeito.")) return;
    if (await run(() => fetch(`/api/stores/${storeId}/orders/${order.id}`, { method: "DELETE" }), "Pedido excluído.")) load();
  }

  return (
    <main>
      <h1>Pedidos</h1>
      <p>Aceite ou recuse novos pedidos. A aprovação automática é configurada em Configurações.</p>

      <div className="tabs">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" aria-pressed={tab === key} onClick={() => setTab(key)}>
            {label} ({groups[key].length})
          </button>
        ))}
      </div>
      <Feedback msg={msg} />

      {groups[tab].length === 0 ? (
        <p className="empty">Nenhum pedido aqui.</p>
      ) : (
        <div className="kds">
          {groups[tab].map((order) => (
            <div key={order.id} className={`ticket${order.status === "PREPARING" ? " preparing" : ""}`}>
              <div className="t-head">
                <span>
                  {order.channel}
                  {order.tableNumber ? ` · mesa ${order.tableNumber}` : ""}
                </span>
                <span className="badge">{order.status}</span>
              </div>
              <div className="hint">
                {new Date(order.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                {order.customerId ? ` · ${order.customerId}` : ""}
                {order.items ? ` · ${order.items.reduce((n, i) => n + i.quantity, 0)} itens` : ""}
              </div>
              <OrderItems items={order.items} />
              <div className="t-total">{brl(order.totalCents)}</div>
              {order.status === "CANCELED" && (
                <div className="actions">
                  <button type="button" className="btn-danger" disabled={busy} onClick={() => removeOrder(order)}>Excluir</button>
                </div>
              )}
              {order.status === "RECEIVED" && (
                <div className="actions">
                  <button type="button" disabled={busy} onClick={() => decide(order, "CONFIRMED")}>Aceitar</button>
                  <button type="button" className="secondary" disabled={busy} onClick={() => decide(order, "CANCELED")}>Recusar</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
