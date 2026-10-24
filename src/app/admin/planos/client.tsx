"use client";

import { useEffect, useState } from "react";
import { Feedback, useAction } from "@/app/(dashboard)/[store]/feedback";
import { FEATURE_LABEL, type PlanFeature } from "@/lib/plans/labels";

type Plan = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  active: boolean;
  maxOrdersPerMonth: number | null;
  maxProducts: number | null;
  maxCustomers: number | null;
  maxCategories: number | null;
  maxMembers: number | null;
  maxDeliveryPeople: number | null;
  features: Partial<Record<PlanFeature, boolean>>;
  _count: { stores: number };
};

const LIMITS = [
  ["maxOrdersPerMonth", "Pedidos por mês"],
  ["maxProducts", "Produtos"],
  ["maxCustomers", "Clientes"],
  ["maxCategories", "Categorias"],
  ["maxMembers", "Usuários"],
  ["maxDeliveryPeople", "Entregadores"],
] as const;

const brl = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
const lim = (v: number | null) => (v == null ? "∞" : String(v));

type Form = {
  name: string;
  description: string;
  price: string;
  active: boolean;
  limits: Record<(typeof LIMITS)[number][0], string>;
  features: Record<PlanFeature, boolean>;
};

const FEATURE_KEYS = Object.keys(FEATURE_LABEL) as PlanFeature[];
const emptyForm = (): Form => ({
  name: "",
  description: "",
  price: "",
  active: true,
  limits: { maxOrdersPerMonth: "", maxProducts: "", maxCustomers: "", maxCategories: "", maxMembers: "", maxDeliveryPeople: "" },
  features: Object.fromEntries(FEATURE_KEYS.map((k) => [k, false])) as Record<PlanFeature, boolean>,
});

export default function PlanosClient() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [form, setForm] = useState<Form>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const { busy, msg, run } = useAction();

  async function reload() {
    const res = await fetch("/api/admin/plans");
    if (res.ok) setPlans(await res.json());
  }

  useEffect(() => {
    reload();
  }, []);

  function startNew() {
    setEditingId(null);
    setForm(emptyForm());
    setOpen(true);
  }

  function startEdit(plan: Plan) {
    const f = emptyForm();
    f.name = plan.name;
    f.description = plan.description ?? "";
    f.price = (plan.priceCents / 100).toFixed(2);
    f.active = plan.active;
    for (const [k] of LIMITS) f.limits[k] = plan[k] == null ? "" : String(plan[k]);
    for (const k of FEATURE_KEYS) f.features[k] = plan.features?.[k] === true;
    setEditingId(plan.id);
    setForm(f);
    setOpen(true);
  }

  async function save() {
    const priceCents = Math.round(Number(form.price.replace(",", ".")) * 100);
    const body: Record<string, unknown> = {
      name: form.name,
      description: form.description,
      priceCents: Number.isFinite(priceCents) ? priceCents : NaN,
      active: form.active,
      features: form.features,
    };
    for (const [k] of LIMITS) body[k] = form.limits[k] === "" ? null : Number(form.limits[k]);
    const ok = await run(
      () =>
        fetch(editingId ? `/api/admin/plans/${editingId}` : "/api/admin/plans", {
          method: editingId ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
      editingId ? "Plano atualizado!" : "Plano criado!",
    );
    if (ok) {
      setOpen(false);
      reload();
    }
  }

  async function remove(plan: Plan) {
    if (!confirm(`Excluir o plano "${plan.name}"?`)) return;
    await run(() => fetch(`/api/admin/plans/${plan.id}`, { method: "DELETE" }), "Plano excluído.");
    reload();
  }

  return (
    <main>
      <h1>Planos de assinatura</h1>
      <p>Defina limites e recursos. Campo de limite vazio significa ilimitado.</p>
      <Feedback msg={msg} />
      {!open && (
        <button type="button" onClick={startNew} style={{ marginTop: 14 }}>
          Novo plano
        </button>
      )}

      {open && (
        <section>
          <h2>{editingId ? "Editar plano" : "Novo plano"}</h2>
          <div className="form-grid">
            <label>
              Nome
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label>
              Preço mensal (R$)
              <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="99,00" />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Descrição
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
            {LIMITS.map(([k, label]) => (
              <label key={k}>
                {label}
                <input
                  value={form.limits[k]}
                  onChange={(e) => setForm({ ...form, limits: { ...form.limits, [k]: e.target.value } })}
                  placeholder="ilimitado"
                  inputMode="numeric"
                />
              </label>
            ))}
          </div>
          <h3>Recursos incluídos</h3>
          <div className="checks">
            {FEATURE_KEYS.map((k) => (
              <label key={k}>
                <input
                  type="checkbox"
                  checked={form.features[k]}
                  onChange={(e) => setForm({ ...form, features: { ...form.features, [k]: e.target.checked } })}
                />
                {FEATURE_LABEL[k]}
              </label>
            ))}
            <label>
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              Plano ativo (disponível para novas lojas)
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
        {plans.length === 0 ? (
          <p className="empty">Nenhum plano cadastrado.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Plano</th>
                  <th>Preço</th>
                  <th>Pedidos/mês</th>
                  <th>Produtos</th>
                  <th>Clientes</th>
                  <th>Recursos</th>
                  <th>Lojas</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.name}</strong> {!p.active && <span className="badge off">inativo</span>}
                      {p.description && <div className="hint">{p.description}</div>}
                    </td>
                    <td>{brl(p.priceCents)}</td>
                    <td>{lim(p.maxOrdersPerMonth)}</td>
                    <td>{lim(p.maxProducts)}</td>
                    <td>{lim(p.maxCustomers)}</td>
                    <td>{FEATURE_KEYS.filter((k) => p.features?.[k] === true).map((k) => FEATURE_LABEL[k]).join(", ") || "—"}</td>
                    <td>{p._count.stores}</td>
                    <td className="row-actions">
                      <button type="button" onClick={() => startEdit(p)}>
                        Editar
                      </button>
                      <button type="button" className="btn-danger" onClick={() => remove(p)}>
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
