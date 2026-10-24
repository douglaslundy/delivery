"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Feedback, useAction } from "../feedback";
import RowActions from "../row-actions";

type Customer = {
  id: string;
  name: string;
  phone: string;
  source: string;
  createdAt: string;
  orderCount: number;
  totalCents: number;
};

const brl = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

export default function ClientesClient() {
  const { store: storeId } = useParams<{ store: string }>();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState({ name: "", phone: "" });
  const [editing, setEditing] = useState<{ id: string; name: string; phone: string } | null>(null);
  const { busy, msg, run } = useAction();

  const load = useCallback(async () => {
    const res = await fetch(`/api/stores/${storeId}/customers`);
    if (res.ok) setCustomers(await res.json());
  }, [storeId]);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const ok = await run(
      () => fetch(`/api/stores/${storeId}/customers`, { method: "POST", body: JSON.stringify(form) }),
      "Cliente cadastrado!",
    );
    if (ok) {
      setForm({ name: "", phone: "" });
      load();
    }
  }

  async function saveEdit() {
    if (!editing) return;
    const ok = await run(
      () =>
        fetch(`/api/stores/${storeId}/customers/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name: editing.name, phone: editing.phone }),
        }),
      "Cliente atualizado!",
    );
    if (ok) {
      setEditing(null);
      load();
    }
  }

  async function remove(c: Customer) {
    if (!window.confirm(`Excluir o cliente "${c.name}"? Os pedidos dele são mantidos.`)) return;
    if (await run(() => fetch(`/api/stores/${storeId}/customers/${c.id}`, { method: "DELETE" }), "Cliente excluído.")) load();
  }

  return (
    <main>
      <h1>Clientes</h1>
      <p>Clientes cadastrados manualmente e os que chamaram ou pediram pelo WhatsApp.</p>

      <section>
        <h2>Cadastrar cliente</h2>
        <form onSubmit={create}>
          <label>
            Nome
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label>
            Telefone (com DDD)
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="5511999999999" required />
          </label>
          <Feedback msg={msg} />
          <button type="submit" disabled={busy}>{busy ? "Salvando..." : "Cadastrar"}</button>
        </form>
      </section>

      <section>
        <h2>Lista de clientes ({customers.length})</h2>
        {customers.length === 0 ? (
          <p className="empty">Nenhum cliente ainda.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Telefone</th>
                <th>Origem</th>
                <th>Pedidos</th>
                <th>Total gasto</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <td>
                    {editing?.id === c.id ? (
                      <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                    ) : (
                      c.name
                    )}
                  </td>
                  <td>
                    {editing?.id === c.id ? (
                      <input value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
                    ) : (
                      c.phone
                    )}
                  </td>
                  <td>
                    <span className={`badge ${c.source === "WHATSAPP" ? "ok" : ""}`}>{c.source === "WHATSAPP" ? "WhatsApp" : "Manual"}</span>
                  </td>
                  <td>{c.orderCount}</td>
                  <td>{brl(c.totalCents)}</td>
                  <td>
                    <RowActions
                      editing={editing?.id === c.id}
                      busy={busy}
                      onEdit={() => setEditing({ id: c.id, name: c.name, phone: c.phone })}
                      onSave={saveEdit}
                      onCancel={() => setEditing(null)}
                      onDelete={() => remove(c)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
