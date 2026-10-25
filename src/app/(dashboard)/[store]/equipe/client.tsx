"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Feedback, useAction } from "../feedback";
import RowActions from "../row-actions";

type Role = "OWNER" | "MANAGER" | "ATTENDANT";
type Member = { id: string; email: string; role: Role };

const ROLE_LABEL: Record<Role, string> = { OWNER: "Dono", MANAGER: "Gerente", ATTENDANT: "Atendente" };

export default function EquipeClient() {
  const { store: storeId } = useParams<{ store: string }>();
  const [members, setMembers] = useState<Member[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState({ email: "", password: "", role: "ATTENDANT" });
  const [editing, setEditing] = useState<{ id: string; role: Role } | null>(null);
  const { busy, msg, run } = useAction();

  const load = useCallback(async () => {
    const res = await fetch(`/api/stores/${storeId}/members`);
    if (res.ok) {
      setMembers(await res.json());
      setLoadError(null);
    } else {
      setLoadError((await res.json().catch(() => ({}))).error ?? "Não foi possível carregar a equipe");
    }
  }, [storeId]);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const ok = await run(
      () => fetch(`/api/stores/${storeId}/members`, { method: "POST", body: JSON.stringify(form) }),
      "Usuário adicionado!",
    );
    if (ok) {
      setForm({ email: "", password: "", role: "ATTENDANT" });
      load();
    }
  }

  async function saveEdit() {
    if (!editing) return;
    const ok = await run(
      () => fetch(`/api/stores/${storeId}/members/${editing.id}`, { method: "PATCH", body: JSON.stringify({ role: editing.role }) }),
      "Papel atualizado!",
    );
    if (ok) {
      setEditing(null);
      load();
    }
  }

  async function remove(m: Member) {
    if (!window.confirm(`Remover ${m.email} da equipe?`)) return;
    if (await run(() => fetch(`/api/stores/${storeId}/members/${m.id}`, { method: "DELETE" }), "Usuário removido.")) load();
  }

  return (
    <main>
      <h1>Equipe</h1>
      <p>Quem pode acessar o painel desta loja. Se o e-mail já tiver conta, ela só é vinculada à loja.</p>

      <section>
        <h2>Adicionar usuário</h2>
        <form onSubmit={create}>
          <label>
            E-mail
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </label>
          <label>
            Senha inicial (obrigatória para conta nova, mín. 8 caracteres)
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </label>
          <label>
            Papel
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="ATTENDANT">Atendente</option>
              <option value="MANAGER">Gerente</option>
            </select>
          </label>
          <Feedback msg={msg} />
          <button type="submit" disabled={busy}>{busy ? "Salvando..." : "Adicionar"}</button>
        </form>
      </section>

      <section>
        <h2>Usuários ({members.length})</h2>
        {loadError && <p role="alert">{loadError}</p>}
        {!loadError && members.length === 0 && <p className="empty">Nenhum usuário.</p>}
        {members.length > 0 && (
          <table>
            <thead>
              <tr><th>E-mail</th><th>Papel</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>{m.email}</td>
                  <td>
                    {editing?.id === m.id ? (
                      <select value={editing.role} onChange={(e) => setEditing({ id: m.id, role: e.target.value as Role })}>
                        <option value="OWNER">Dono</option>
                        <option value="MANAGER">Gerente</option>
                        <option value="ATTENDANT">Atendente</option>
                      </select>
                    ) : (
                      <span className="badge">{ROLE_LABEL[m.role]}</span>
                    )}
                  </td>
                  <td>
                    <RowActions
                      editing={editing?.id === m.id}
                      busy={busy}
                      onEdit={() => setEditing({ id: m.id, role: m.role })}
                      onSave={saveEdit}
                      onCancel={() => setEditing(null)}
                      onDelete={() => remove(m)}
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
