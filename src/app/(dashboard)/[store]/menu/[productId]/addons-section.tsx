"use client";

import { useCallback, useEffect, useState } from "react";
import { Feedback, useAction } from "../../feedback";
import RowActions from "../../row-actions";

export type Addon = {
  id: string;
  groupName: string;
  name: string;
  priceCents: number;
  required: boolean;
  multiple: boolean;
  active: boolean;
};
type Draft = { groupName: string; name: string; price: string; required: boolean; multiple: boolean; active: boolean };

const EMPTY: Draft = { groupName: "", name: "", price: "0", required: false, multiple: false, active: true };
const brl = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

function DraftFields({ draft, onChange }: { draft: Draft; onChange: (d: Draft) => void }) {
  return (
    <>
      <input placeholder="Grupo (ex.: Molhos)" value={draft.groupName} onChange={(e) => onChange({ ...draft, groupName: e.target.value })} />
      <input placeholder="Nome" value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })} />
      <input placeholder="Preço em centavos" inputMode="numeric" value={draft.price} onChange={(e) => onChange({ ...draft, price: e.target.value })} />
      <label><input type="checkbox" checked={draft.required} onChange={(e) => onChange({ ...draft, required: e.target.checked })} />Obrigatório</label>
      <label><input type="checkbox" checked={draft.multiple} onChange={(e) => onChange({ ...draft, multiple: e.target.checked })} />Múltipla escolha</label>
      <label><input type="checkbox" checked={draft.active} onChange={(e) => onChange({ ...draft, active: e.target.checked })} />Ativo</label>
    </>
  );
}

const payload = (d: Draft) => ({
  groupName: d.groupName.trim(),
  name: d.name.trim(),
  priceCents: Number(d.price) || 0,
  required: d.required,
  multiple: d.multiple,
  active: d.active,
});

export default function AddonsSection({ storeId, productId }: { storeId: string; productId: string }) {
  const base = `/api/stores/${storeId}/products/${productId}/addons`;
  const [groups, setGroups] = useState<Record<string, Addon[]>>({});
  const [form, setForm] = useState<Draft>(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Draft>(EMPTY);
  const { busy, msg, run } = useAction();

  const reload = useCallback(async () => {
    const res = await fetch(base);
    if (res.ok) setGroups(await res.json());
  }, [base]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.groupName.trim() || !form.name.trim()) return;
    const ok = await run(() => fetch(base, { method: "POST", body: JSON.stringify(payload(form)) }), "Adicional criado!");
    if (ok) {
      setForm({ ...EMPTY, groupName: form.groupName });
      reload();
    }
  }

  async function save() {
    if (!editId) return;
    const ok = await run(() => fetch(`${base}/${editId}`, { method: "PATCH", body: JSON.stringify(payload(edit)) }), "Adicional atualizado!");
    if (ok) {
      setEditId(null);
      reload();
    }
  }

  async function remove(a: Addon) {
    if (!window.confirm(`Excluir o adicional "${a.name}"?`)) return;
    if (await run(() => fetch(`${base}/${a.id}`, { method: "DELETE" }), "Adicional excluído.")) reload();
  }

  return (
    <section>
      <h2>Adicionais</h2>
      {Object.keys(groups).length === 0 && <p className="empty">Nenhum adicional cadastrado.</p>}
      {Object.entries(groups).map(([groupName, group]) => (
        <div key={groupName}>
          <h3>{groupName}</h3>
          <ul>
            {group.map((a) => (
              <li key={a.id}>
                {editId === a.id ? (
                  <DraftFields draft={edit} onChange={setEdit} />
                ) : (
                  <>
                    {a.name} <span className="badge">{brl(a.priceCents)}</span>
                    {a.required && <span className="badge warn">Obrigatório</span>}
                    {a.multiple && <span className="badge">Múltipla</span>}
                    {!a.active && <span className="badge off">Inativo</span>}
                  </>
                )}
                <RowActions
                  editing={editId === a.id}
                  busy={busy}
                  onEdit={() => {
                    setEditId(a.id);
                    setEdit({ groupName: a.groupName, name: a.name, price: String(a.priceCents), required: a.required, multiple: a.multiple, active: a.active });
                  }}
                  onSave={save}
                  onCancel={() => setEditId(null)}
                  onDelete={() => remove(a)}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
      <form onSubmit={create}>
        <h3>Novo adicional</h3>
        <DraftFields draft={form} onChange={setForm} />
        <button type="submit" disabled={busy}>{busy ? "Salvando..." : "Adicionar"}</button>
      </form>
      <Feedback msg={msg} />
    </section>
  );
}
