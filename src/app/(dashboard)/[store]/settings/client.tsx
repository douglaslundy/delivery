"use client";

import { useState } from "react";
import { useParams } from "next/navigation";

export default function SettingsPageClient() {
  const params = useParams<{ store: string }>();
  const storeId = params.store;

  const [hours, setHours] = useState({ day: "MON", opensAt: "11:00", closesAt: "23:00" });
  const [estimatedDeliveryMinutes, setEstimatedDeliveryMinutes] = useState("");
  const [tableCount, setTableCount] = useState("");
  const [hasPdv, setHasPdv] = useState(false);

  async function patch(body: Record<string, unknown>) {
    await fetch(`/api/stores/${storeId}/settings`, { method: "PATCH", body: JSON.stringify(body) });
  }

  return (
    <main>
      <h1>Configuracoes</h1>

      <section>
        <h2>Horario de funcionamento</h2>
        <select value={hours.day} onChange={(e) => setHours({ ...hours, day: e.target.value })}>
          {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((day) => (
            <option key={day} value={day}>{day}</option>
          ))}
        </select>
        <input type="time" value={hours.opensAt} onChange={(e) => setHours({ ...hours, opensAt: e.target.value })} />
        <input type="time" value={hours.closesAt} onChange={(e) => setHours({ ...hours, closesAt: e.target.value })} />
        <button onClick={() => patch({ businessHours: [hours] })}>Salvar horario</button>
      </section>

      <section>
        <h2>Tempo de entrega estimado</h2>
        <input placeholder="Minutos" value={estimatedDeliveryMinutes} onChange={(e) => setEstimatedDeliveryMinutes(e.target.value)} />
        <button onClick={() => patch({ estimatedDeliveryMinutes: Number(estimatedDeliveryMinutes) })}>Salvar</button>
      </section>

      <section>
        <h2>Estrutura do salao</h2>
        <input placeholder="Numero de mesas" value={tableCount} onChange={(e) => setTableCount(e.target.value)} />
        <label>
          <input type="checkbox" checked={hasPdv} onChange={(e) => setHasPdv(e.target.checked)} />
          Usa PDV
        </label>
        <button onClick={() => patch({ tableCount: Number(tableCount), hasPdv })}>Salvar</button>
      </section>
    </main>
  );
}
