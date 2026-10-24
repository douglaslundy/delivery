"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Feedback, useAction } from "../feedback";

type Settings = {
  autoAcceptOrders: boolean;
  tableCount: number | null;
  hasPdv: boolean;
  estimatedDeliveryMinutes: number | null;
  businessHours: { day: string; opensAt: string; closesAt: string }[] | null;
};

export default function SettingsPageClient() {
  const params = useParams<{ store: string }>();
  const storeId = params.store;

  const [hours, setHours] = useState({ day: "MON", opensAt: "11:00", closesAt: "23:00" });
  const [estimatedDeliveryMinutes, setEstimatedDeliveryMinutes] = useState("");
  const [tableCount, setTableCount] = useState("");
  const [hasPdv, setHasPdv] = useState(false);
  const [autoAccept, setAutoAccept] = useState(false);

  const approval = useAction();
  const hoursAction = useAction();
  const deliveryAction = useAction();
  const salaoAction = useAction();

  useEffect(() => {
    fetch(`/api/stores/${storeId}/settings`)
      .then((res) => (res.ok ? res.json() : null))
      .then((s: Settings | null) => {
        if (!s) return;
        setAutoAccept(s.autoAcceptOrders);
        setHasPdv(s.hasPdv);
        setTableCount(s.tableCount != null ? String(s.tableCount) : "");
        setEstimatedDeliveryMinutes(s.estimatedDeliveryMinutes != null ? String(s.estimatedDeliveryMinutes) : "");
        if (s.businessHours?.[0]) setHours(s.businessHours[0]);
      });
  }, [storeId]);

  const patch = (body: Record<string, unknown>) =>
    fetch(`/api/stores/${storeId}/settings`, { method: "PATCH", body: JSON.stringify(body) });

  return (
    <main>
      <h1>Configurações</h1>

      <section>
        <h2>Aprovação de pedidos</h2>
        <fieldset>
          <label>
            <input type="radio" checked={!autoAccept} onChange={() => setAutoAccept(false)} />
            Manual (você aceita ou recusa em Pedidos)
          </label>
          <label>
            <input type="radio" checked={autoAccept} onChange={() => setAutoAccept(true)} />
            Automática (pedidos entram já confirmados)
          </label>
        </fieldset>
        <Feedback msg={approval.msg} />
        <div>
          <button type="button" disabled={approval.busy} onClick={() => approval.run(() => patch({ autoAcceptOrders: autoAccept }))}>
            {approval.busy ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </section>

      <section>
        <h2>Horário de funcionamento</h2>
        <select value={hours.day} onChange={(e) => setHours({ ...hours, day: e.target.value })}>
          {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((day) => (
            <option key={day} value={day}>{day}</option>
          ))}
        </select>
        <input type="time" value={hours.opensAt} onChange={(e) => setHours({ ...hours, opensAt: e.target.value })} />
        <input type="time" value={hours.closesAt} onChange={(e) => setHours({ ...hours, closesAt: e.target.value })} />
        <button type="button" disabled={hoursAction.busy} onClick={() => hoursAction.run(() => patch({ businessHours: [hours] }), "Horário salvo!")}>
          {hoursAction.busy ? "Salvando..." : "Salvar horário"}
        </button>
        <Feedback msg={hoursAction.msg} />
      </section>

      <section>
        <h2>Tempo de entrega estimado</h2>
        <input placeholder="Minutos" value={estimatedDeliveryMinutes} onChange={(e) => setEstimatedDeliveryMinutes(e.target.value)} />
        <button
          type="button"
          disabled={deliveryAction.busy}
          onClick={() => deliveryAction.run(() => patch({ estimatedDeliveryMinutes: Number(estimatedDeliveryMinutes) }))}
        >
          {deliveryAction.busy ? "Salvando..." : "Salvar"}
        </button>
        <Feedback msg={deliveryAction.msg} />
      </section>

      <section>
        <h2>Estrutura do salão</h2>
        <input placeholder="Número de mesas" value={tableCount} onChange={(e) => setTableCount(e.target.value)} />
        <label>
          <input type="checkbox" checked={hasPdv} onChange={(e) => setHasPdv(e.target.checked)} />
          Usa PDV
        </label>
        <button
          type="button"
          disabled={salaoAction.busy}
          onClick={() => salaoAction.run(() => patch({ tableCount: Number(tableCount), hasPdv }))}
        >
          {salaoAction.busy ? "Salvando..." : "Salvar"}
        </button>
        <Feedback msg={salaoAction.msg} />
      </section>
    </main>
  );
}
