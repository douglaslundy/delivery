"use client";

import { useCallback, useEffect, useState } from "react";
import { Feedback, useAction } from "../feedback";
import RowActions from "../row-actions";

type Category = { id: string; name: string; kind: string };
const KINDS = [["EXPENSE", "Despesa"], ["INCOME", "Receita"]] as const;
const kindLabel = (k: string) => KINDS.find(([v]) => v === k)?.[1] ?? k;

export default function FinanceCategories({ storeId }: { storeId: string }) {
  const base = `/api/stores/${storeId}/finance/categories`;
  const [items, setItems] = useState<Category[]>([]);
  const [form, setForm] = useState({ name: "", kind: "EXPENSE" });
  const [edit, setEdit] = useState<Category | null>(null);
  const { busy, msg, run } = useAction();

  const reload = useCallback(async () => {
    const res = await fetch(base);
    if (res.ok) setItems(await res.json());
  }, [base]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (await run(() => fetch(base, { method: "POST", body: JSON.stringify({ name: form.name.trim(), kind: form.kind }) }), "Categoria criada!")) {
      setForm({ name: "", kind: form.kind });
      reload();
    }
  }

  async function save() {
    if (!edit) return;
    if (await run(() => fetch(`${base}/${edit.id}`, { method: "PATCH", body: JSON.stringify({ name: edit.name, kind: edit.kind }) }), "Categoria atualizada!")) {
      setEdit(null);
      reload();
    }
  }

  async function remove(c: Category) {
    if (!window.confirm(`Excluir a categoria "${c.name}"?`)) return;
    if (await run(() => fetch(`${base}/${c.id}`, { method: "DELETE" }), "Categoria excluída.")) reload();
  }

  return (
    <section>
      <h2>Categorias financeiras</h2>
      {items.length === 0 && <p className="empty">Nenhuma categoria cadastrada.</p>}
      <ul>
        {items.map((c) => (
          <li key={c.id}>
            {edit?.id === c.id ? (
              <>
                <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
                <select value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value })}>
                  {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </>
            ) : (
              <>
                <strong>{c.name}</strong> <span className={`badge${c.kind === "INCOME" ? " ok" : " warn"}`}>{kindLabel(c.kind)}</span>
              </>
            )}
            <RowActions editing={edit?.id === c.id} busy={busy} onEdit={() => setEdit(c)} onSave={save} onCancel={() => setEdit(null)} onDelete={() => remove(c)} />
          </li>
        ))}
      </ul>
      <form onSubmit={create}>
        <input placeholder="Nome da categoria" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
          {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button type="submit" disabled={busy}>Adicionar categoria</button>
      </form>
      <Feedback msg={msg} />
    </section>
  );
}
