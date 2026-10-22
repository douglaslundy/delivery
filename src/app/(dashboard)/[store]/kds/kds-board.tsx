"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { io } from "socket.io-client";
import { nextStatus } from "@/lib/orders/stateMachine";

type Order = {
  id: string;
  status: string;
  channel: "PDV" | "SALAO" | "DELIVERY" | "AGENDADO";
  totalCents: number;
  tableNumber: string | null;
};

const VISIBLE_STATUSES = ["CONFIRMED", "PREPARING"];

export default function KdsBoard() {
  const params = useParams<{ store: string }>();
  const storeId = params.store;
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    fetch(`/api/stores/${storeId}/orders?status=active`)
      .then((r) => r.json())
      .then((data: Order[]) => setOrders(data.filter((o) => VISIBLE_STATUSES.includes(o.status))));

    const socket = io();
    socket.emit("join", `store:${storeId}:kds`);
    socket.on("order_status_changed", () => {
      fetch(`/api/stores/${storeId}/orders?status=active`)
        .then((r) => r.json())
        .then((data: Order[]) => setOrders(data.filter((o) => VISIBLE_STATUSES.includes(o.status))));
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
      <ul>
        {orders.map((order) => (
          <li key={order.id}>
            {order.channel} {order.tableNumber ? `mesa ${order.tableNumber}` : ""} — {order.status} — R$ {(order.totalCents / 100).toFixed(2)}
            <button onClick={() => advance(order)}>Avancar</button>
          </li>
        ))}
      </ul>
    </main>
  );
}
