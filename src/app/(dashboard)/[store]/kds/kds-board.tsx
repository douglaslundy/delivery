"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { io } from "socket.io-client";
import OrderItems, { type OrderLine } from "@/components/order-items";
import { nextStatus } from "@/lib/orders/stateMachine";

type Order = {
  id: string;
  status: string;
  channel: "PDV" | "SALAO" | "DELIVERY" | "AGENDADO";
  totalCents: number;
  tableNumber: string | null;
  items?: OrderLine[];
};

const VISIBLE_STATUSES = ["CONFIRMED", "PREPARING"];

async function fetchActiveOrders(storeId: string): Promise<Order[]> {
  const res = await fetch(`/api/stores/${storeId}/orders?status=active`);
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.filter((o: Order) => VISIBLE_STATUSES.includes(o.status));
}

export default function KdsBoard() {
  const params = useParams<{ store: string }>();
  const storeId = params.store;
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    fetchActiveOrders(storeId).then(setOrders);

    const socket = io();
    socket.emit("join", `store:${storeId}:kds`);
    socket.on("order_status_changed", () => {
      fetchActiveOrders(storeId).then(setOrders);
    });

    return () => {
      socket.disconnect();
    };
  }, [storeId]);

  async function advance(order: Order) {
    const status = nextStatus(order.status as never, order.channel);
    if (!status) return;

    await fetch(`/api/stores/${storeId}/orders/${order.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  }

  return (
    <main>
      <h1>KDS</h1>
      <p>Pedidos em preparo, atualizados em tempo real.</p>
      {orders.length === 0 ? (
        <p className="empty">Nenhum pedido em andamento.</p>
      ) : (
        <div className="kds">
          {orders.map((order) => (
            <div key={order.id} className={`ticket${order.status === "PREPARING" ? " preparing" : ""}`}>
              <div className="t-head">
                <span>{order.channel}{order.tableNumber ? ` · mesa ${order.tableNumber}` : ""}</span>
                <span className={`badge${order.status === "PREPARING" ? " warn" : ""}`}>
                  {order.status === "PREPARING" ? "Preparando" : "Confirmado"}
                </span>
              </div>
              <OrderItems items={order.items} />
              <div className="t-total">R$ {(order.totalCents / 100).toFixed(2).replace(".", ",")}</div>
              <button onClick={() => advance(order)}>Avançar</button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
