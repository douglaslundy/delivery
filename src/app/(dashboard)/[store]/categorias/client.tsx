"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Feedback, useAction } from "../feedback";

type Category = { id: string; name: string; active: boolean };

export default function CategoriasClient() {
  const { store: storeId } = useParams<{ store: string }>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const { busy, msg, run } = useAction();
  const base = `/api/stores/${storeId}/categories`;

  const load = useCallback(async () => {
    const res = await fetch(base);
    if (res.ok) setCategories(await res.json());
  }, [base]);

  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    if (!name.trim()) return;
    if (await run(() => fetch(base, { method: "POST", body: JSON.stringify({ name }) }), "Categoria criada!")) {
      setName("");
      load();
    }
  }

  async function rename() {
    if (!editing) return;
    if (await run(() => fetch(`${base}/${editing.id}`, { method: "PATCH", body: JSON.stringify({ name: editing.name }) }), "Categoria renomeada!")) {
      setEditing(null);
      load();
    }
  }

  async function remove(category: Category) {
    if (!window.confirm(`Excluir a categoria "${category.name}"?`)) return;
    if (await run(() => fetch(`${base}/${category.id}`, { method: "DELETE" }), "Categoria excluída.")) load();
  }

  return (
    <main>
      <h1>Categorias</h1>
      <p>Organize o cardápio em grupos. Uma categoria só pode ser excluída depois de esvaziada.</p>

      <section>
        <h2>Nova categoria</h2>
        <div>
          <input placeholder="Ex.: Pizzas" value={name} onChange={(e) => setName(e.target.value)} />
          <button type="button" disabled={busy} onClick={create}>{busy ? "Salvando..." : "Adicionar"}</button>
        </div>
        <Feedback msg={msg} />
      </section>

      <section>
        <h2>Categorias cadastradas</h2>
        {categories.length === 0 ? (
          <p className="empty">Nenhuma categoria ainda.</p>
        ) : (
          <ul>
            {categories.map((category) => (
              <li key={category.id}>
                {editing?.id === category.id ? (
                  <>
                    <input value={editing.name} onChange={(e) => setEditing({ id: category.id, name: e.target.value })} />
                    <button type="button" disabled={busy} onClick={rename}>Salvar</button>
                    <button type="button" className="secondary" onClick={() => setEditing(null)}>Cancelar</button>
                  </>
                ) : (
                  <>
                    <strong>{category.name}</strong>
                    <button type="button" onClick={() => setEditing({ id: category.id, name: category.name })}>Renomear</button>
                    <button type="button" className="secondary" disabled={busy} onClick={() => remove(category)}>Excluir</button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
