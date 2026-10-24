"use client";

import { useEffect, useState } from "react";
import { Feedback, useAction } from "@/app/(dashboard)/[store]/feedback";

type Store = {
  id: string;
  name: string;
  slug: string;
  foodCategory: string | null;
  subscriptionStatus: string;
  plan: { id: string; name: string } | null;
  ownerEmail: string | null;
  ordersThisMonth: number;
  products: number;
  customers: number;
  createdAt: string;
};
type Plan = { id: string; name: string };

const STATUS_LABEL: Record<string, string> = { TRIAL: "Teste", ACTIVE: "Ativa", SUSPENDED: "Suspensa", CANCELED: "Cancelada" };
const STATUS_BADGE: Record<string, string> = { TRIAL: "", ACTIVE: "ok", SUSPENDED: "warn", CANCELED: "off" };

const EMPTY = { name: "", slug: "", foodCategory: "", planId: "", subscriptionStatus: "ACTIVE", ownerEmail: "", ownerPassword: "" };

export default function LojasClient() {
  const [stores, setStores] = useState<Store[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const { busy, msg, run } = useAction();

  async function reload() {
    const [s, p] = await Promise.all([fetch("/api/admin/stores"), fetch("/api/admin/plans")]);
    if (s.ok) setStores(await s.json());
    if (p.ok) setPlans(await p.json());
  }

  useEffect(() => {
    reload();
  }, []);

  function startNew() {
    setEditingId(null);
    setForm(EMPTY);
    setOpen(true);
  }

  function startEdit(store: Store) {
    setEditingId(store.id);
    setForm({
      name: store.name,
      slug: store.slug,
      foodCategory: store.foodCategory ?? "",
      planId: store.plan?.id ?? "",
      subscriptionStatus: store.subscriptionStatus,
      ownerEmail: store.ownerEmail ?? "",
      ownerPassword: "",
    });
    setOpen(true);
  }

  async function save() {
    const ok = await run(async () => {
      const body: Record<string, unknown> = {
        name: form.name,
        slug: form.slug,
        foodCategory: form.foodCategory,
        planId: form.planId,
      };
      if (editingId) {
        body.subscriptionStatus = form.subscriptionStatus;
        if (form.ownerPassword) body.ownerPassword = form.ownerPassword;
      } else {
        body.ownerEmail = form.ownerEmail;
        body.ownerPassword = form.ownerPassword;
      }
      return fetch(editingId ? `/api/admin/stores/${editingId}` : "/api/admin/stores", {
        method: editingId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    }, editingId ? "Loja atualizada!" : "Loja criada!");
    if (ok) {
      setOpen(false);
      setEditingId(null);
      setForm(EMPTY);
      reload();
    }
  }

  async function toggle(store: Store) {
    const suspend = store.subscriptionStatus === "ACTIVE" || store.subscriptionStatus === "TRIAL";
    if (suspend && !confirm(`Suspender a loja "${store.name}"? Ela perde o acesso imediatamente.`)) return;
    await run(
      () =>
        fetch(`/api/admin/stores/${store.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ subscriptionStatus: suspend ? "SUSPENDED" : "ACTIVE" }),
        }),
      suspend ? "Loja suspensa." : "Loja reativada.",
    );
    reload();
  }

  async function remove(store: Store) {
    if (!confirm(`Excluir a loja "${store.name}" e TODOS os seus dados (pedidos, produtos, clientes)? Isso não pode ser desfeito.`)) return;
    await run(() => fetch(`/api/admin/stores/${store.id}`, { method: "DELETE" }), "Loja excluída.");
    reload();
  }

  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  return (
    <main>
      <h1>Lojas</h1>
      <p>Todos os estabelecimentos que usam a plataforma.</p>
      <Feedback msg={msg} />
      {!open && (
        <button type="button" onClick={startNew} style={{ marginTop: 14 }}>
          Nova loja
        </button>
      )}

      {open && (
        <section>
          <h2>{editingId ? "Editar loja" : "Nova loja"}</h2>
          <div className="form-grid">
            <label>
              Nome
              <input value={form.name} onChange={set("name")} />
            </label>
            <label>
              Slug (subdomínio)
              <input value={form.slug} onChange={set("slug")} placeholder="minha-loja" />
            </label>
            <label>
              Categoria
              <input value={form.foodCategory} onChange={set("foodCategory")} placeholder="pizzaria, hamburgueria..." />
            </label>
            <label>
              Plano
              <select value={form.planId} onChange={set("planId")}>
                <option value="">Sem plano (sem limites)</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            {editingId ? (
              <label>
                Status
                <select value={form.subscriptionStatus} onChange={set("subscriptionStatus")}>
                  {Object.entries(STATUS_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label>
                E-mail do dono
                <input type="email" value={form.ownerEmail} onChange={set("ownerEmail")} />
              </label>
            )}
            <label>
              {editingId ? "Nova senha do dono (opcional)" : "Senha do dono"}
              <input type="password" value={form.ownerPassword} onChange={set("ownerPassword")} autoComplete="new-password" />
            </label>
          </div>
          <div>
            <button type="button" disabled={busy} onClick={save}>
              {busy ? "Salvando..." : "Salvar"}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
              Cancelar
            </button>
          </div>
        </section>
      )}

      <section>
        {stores.length === 0 ? (
          <p className="empty">Nenhuma loja cadastrada.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Loja</th>
                  <th>Plano</th>
                  <th>Status</th>
                  <th>Pedidos/mês</th>
                  <th>Produtos</th>
                  <th>Clientes</th>
                  <th>Criada em</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {stores.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.name}</strong>
                      <div className="hint">
                        {s.slug} · {s.ownerEmail ?? "sem dono"}
                      </div>
                    </td>
                    <td>{s.plan?.name ?? "—"}</td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[s.subscriptionStatus] ?? ""}`}>{STATUS_LABEL[s.subscriptionStatus] ?? s.subscriptionStatus}</span>
                    </td>
                    <td>{s.ordersThisMonth}</td>
                    <td>{s.products}</td>
                    <td>{s.customers}</td>
                    <td>{new Date(s.createdAt).toLocaleDateString("pt-BR")}</td>
                    <td className="row-actions">
                      <button type="button" onClick={() => startEdit(s)}>
                        Editar
                      </button>
                      <button type="button" onClick={() => toggle(s)}>
                        {s.subscriptionStatus === "ACTIVE" || s.subscriptionStatus === "TRIAL" ? "Suspender" : "Reativar"}
                      </button>
                      <button type="button" className="btn-danger" onClick={() => remove(s)}>
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
