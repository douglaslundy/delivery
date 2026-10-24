"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Feedback, useAction } from "../feedback";
import RowActions from "../row-actions";

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
  const [editPerson, setEditPerson] = useState<{ id: string; name: string; phone: string; active: boolean } | null>(null);
  const [editZone, setEditZone] = useState<{ id: string; name: string; fee: string } | null>(null);
  const { busy, msg, run } = useAction();

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
    await run(async () => {
      const res = await fetch(`/api/stores/${storeId}/delivery-people`, { method: "POST", body: JSON.stringify(personForm) });
      if (res.ok) { setPersonForm({ name: "", phone: "" }); reload(); }
      return res;
    }, "Entregador adicionado!");
  }

  async function createZone() {
    await run(async () => {
      const res = await fetch(`/api/stores/${storeId}/delivery-zones`, {
        method: "POST",
        body: JSON.stringify({ name: zoneForm.name, feeCents: Number(zoneForm.feeCents) }),
      });
      if (res.ok) { setZoneForm({ name: "", feeCents: "" }); reload(); }
      return res;
    }, "Zona adicionada!");
  }

  async function savePerson() {
    if (!editPerson) return;
    await run(async () => {
      const res = await fetch(`/api/stores/${storeId}/delivery-people/${editPerson.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editPerson.name, phone: editPerson.phone, active: editPerson.active }),
      });
      if (res.ok) { setEditPerson(null); reload(); }
      return res;
    }, "Entregador atualizado!");
  }

  async function removePerson(person: DeliveryPerson) {
    if (!window.confirm(`Excluir o entregador "${person.name}"?`)) return;
    await run(async () => {
      const res = await fetch(`/api/stores/${storeId}/delivery-people/${person.id}`, { method: "DELETE" });
      if (res.ok) reload();
      return res;
    }, "Entregador excluído.");
  }

  async function saveZone() {
    if (!editZone) return;
    await run(async () => {
      const res = await fetch(`/api/stores/${storeId}/delivery-zones/${editZone.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editZone.name, feeCents: Number(editZone.fee) }),
      });
      if (res.ok) { setEditZone(null); reload(); }
      return res;
    }, "Zona atualizada!");
  }

  async function removeZone(zone: DeliveryZone) {
    if (!window.confirm(`Excluir a zona "${zone.name}"?`)) return;
    await run(async () => {
      const res = await fetch(`/api/stores/${storeId}/delivery-zones/${zone.id}`, { method: "DELETE" });
      if (res.ok) reload();
      return res;
    }, "Zona excluída.");
  }

  async function assign() {
    await run(async () => {
      const res = await fetch(`/api/stores/${storeId}/orders/${assignForm.orderId}/assign-delivery`, {
        method: "POST",
        body: JSON.stringify({ deliveryPersonId: assignForm.deliveryPersonId }),
      });
      if (res.ok) setAssignForm({ orderId: "", deliveryPersonId: "" });
      return res;
    }, "Entregador atribuído!");
  }

  return (
    <main>
      <h1>Entregas</h1>

      <section>
        <h2>Entregadores</h2>
        <ul>
          {people.map((person) => (
            <li key={person.id}>
              {editPerson?.id === person.id ? (
                <>
                  <input value={editPerson.name} onChange={(e) => setEditPerson({ ...editPerson, name: e.target.value })} />
                  <input value={editPerson.phone} onChange={(e) => setEditPerson({ ...editPerson, phone: e.target.value })} />
                  <label>
                    <input type="checkbox" checked={editPerson.active} onChange={(e) => setEditPerson({ ...editPerson, active: e.target.checked })} />
                    ativo
                  </label>
                </>
              ) : (
                <>
                  <strong>{person.name}</strong> <span>{person.phone}</span> <span className={`badge ${person.active ? "ok" : "off"}`}>{person.active ? "ativo" : "inativo"}</span>
                </>
              )}
              <RowActions
                editing={editPerson?.id === person.id}
                busy={busy}
                onEdit={() => setEditPerson({ id: person.id, name: person.name, phone: person.phone, active: person.active })}
                onSave={savePerson}
                onCancel={() => setEditPerson(null)}
                onDelete={() => removePerson(person)}
              />
            </li>
          ))}
        </ul>
        <div>
          <input placeholder="Nome" value={personForm.name} onChange={(e) => setPersonForm({ ...personForm, name: e.target.value })} />
          <input placeholder="Telefone" value={personForm.phone} onChange={(e) => setPersonForm({ ...personForm, phone: e.target.value })} />
          <button disabled={busy} onClick={createPerson}>Adicionar entregador</button>
        </div>
      </section>

      <section>
        <h2>Zonas de entrega</h2>
        <ul>
          {zones.map((zone) => (
            <li key={zone.id}>
              {editZone?.id === zone.id ? (
                <>
                  <input value={editZone.name} onChange={(e) => setEditZone({ ...editZone, name: e.target.value })} />
                  <input value={editZone.fee} onChange={(e) => setEditZone({ ...editZone, fee: e.target.value })} placeholder="Taxa em centavos" />
                </>
              ) : (
                <>
                  <strong>{zone.name}</strong> <span className="badge">taxa R$ {(zone.feeCents / 100).toFixed(2).replace(".", ",")}</span>
                </>
              )}
              <RowActions
                editing={editZone?.id === zone.id}
                busy={busy}
                onEdit={() => setEditZone({ id: zone.id, name: zone.name, fee: String(zone.feeCents) })}
                onSave={saveZone}
                onCancel={() => setEditZone(null)}
                onDelete={() => removeZone(zone)}
              />
            </li>
          ))}
        </ul>
        <div>
          <input placeholder="Nome da zona" value={zoneForm.name} onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })} />
          <input placeholder="Taxa em centavos" value={zoneForm.feeCents} onChange={(e) => setZoneForm({ ...zoneForm, feeCents: e.target.value })} />
          <button disabled={busy} onClick={createZone}>Adicionar zona</button>
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
        <button disabled={busy} onClick={assign}>Atribuir</button>
      </section>
      <Feedback msg={msg} />
    </main>
  );
}
