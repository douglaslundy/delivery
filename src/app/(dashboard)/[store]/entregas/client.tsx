"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type DeliveryPerson = { id: string; name: string; phone: string; active: boolean };
type DeliveryZone = { id: string; name: string; feeCents: number };

export default function EntregasPageClient() {
  const params = useParams<{ store: string }>();
  const storeId = params.store;

  const [people, setPeople] = useState<DeliveryPerson[]>([]);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [personForm, setPersonForm] = useState({ name: "", phone: "" });
  const [zoneForm, setZoneForm] = useState({ name: "", feeCents: "" });
  const [assignForm, setAssignForm] = useState({ orderId: "", deliveryPersonId: "" });

  async function reload() {
    const [peopleRes, zonesRes] = await Promise.all([
      fetch(`/api/stores/${storeId}/delivery-people`),
      fetch(`/api/stores/${storeId}/delivery-zones`),
    ]);
    setPeople(await peopleRes.json());
    setZones(await zonesRes.json());
  }

  useEffect(() => {
    reload();
  }, [storeId]);

  async function createPerson() {
    await fetch(`/api/stores/${storeId}/delivery-people`, { method: "POST", body: JSON.stringify(personForm) });
    setPersonForm({ name: "", phone: "" });
    reload();
  }

  async function createZone() {
    await fetch(`/api/stores/${storeId}/delivery-zones`, {
      method: "POST",
      body: JSON.stringify({ name: zoneForm.name, feeCents: Number(zoneForm.feeCents) }),
    });
    setZoneForm({ name: "", feeCents: "" });
    reload();
  }

  async function assign() {
    await fetch(`/api/stores/${storeId}/orders/${assignForm.orderId}/assign-delivery`, {
      method: "POST",
      body: JSON.stringify({ deliveryPersonId: assignForm.deliveryPersonId }),
    });
    setAssignForm({ orderId: "", deliveryPersonId: "" });
  }

  return (
    <main>
      <h1>Entregas</h1>

      <section>
        <h2>Entregadores</h2>
        <ul>
          {people.map((person) => (
            <li key={person.id}>{person.name} — {person.phone} — {person.active ? "ativo" : "inativo"}</li>
          ))}
        </ul>
        <div>
          <input placeholder="Nome" value={personForm.name} onChange={(e) => setPersonForm({ ...personForm, name: e.target.value })} />
          <input placeholder="Telefone" value={personForm.phone} onChange={(e) => setPersonForm({ ...personForm, phone: e.target.value })} />
          <button onClick={createPerson}>Adicionar entregador</button>
        </div>
      </section>

      <section>
        <h2>Zonas de entrega</h2>
        <ul>
          {zones.map((zone) => (
            <li key={zone.id}>{zone.name} — taxa R$ {(zone.feeCents / 100).toFixed(2)}</li>
          ))}
        </ul>
        <div>
          <input placeholder="Nome da zona" value={zoneForm.name} onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })} />
          <input placeholder="Taxa em centavos" value={zoneForm.feeCents} onChange={(e) => setZoneForm({ ...zoneForm, feeCents: e.target.value })} />
          <button onClick={createZone}>Adicionar zona</button>
        </div>
      </section>

      <section>
        <h2>Atribuir entregador a um pedido</h2>
        <input placeholder="ID do pedido" value={assignForm.orderId} onChange={(e) => setAssignForm({ ...assignForm, orderId: e.target.value })} />
        <select value={assignForm.deliveryPersonId} onChange={(e) => setAssignForm({ ...assignForm, deliveryPersonId: e.target.value })}>
          <option value="">Selecione um entregador</option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>{person.name}</option>
          ))}
        </select>
        <button onClick={assign}>Atribuir</button>
      </section>
    </main>
  );
}
