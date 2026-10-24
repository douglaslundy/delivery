"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Feedback, useAction } from "../feedback";
import RowActions from "../row-actions";
import FinanceCategories from "./finance-categories";

type Entry = { id: string; kind: string; amountCents: number; description: string; dueDate: string | null; paidAt: string | null };
type Account = { id: string; name: string; initialBalanceCents: number; balanceCents: number };
type Report = { bankAccountId?: string | null; channel?: string; totalCents?: number; description?: string; amountCents?: number; overdue?: boolean };

export default function FinanceiroPageClient() {
  const params = useParams<{ store: string }>();
  const storeId = params.store;

  const [entries, setEntries] = useState<Entry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cashFlow, setCashFlow] = useState<Report[]>([]);
  const [payables, setPayables] = useState<Report[]>([]);
  const [revenue, setRevenue] = useState<Report[]>([]);
  const [form, setForm] = useState({ kind: "EXPENSE", amountCents: "", description: "", dueDate: "" });
  const { busy, msg, run } = useAction();

  async function reload() {
    const [entriesRes, accountsRes, cashFlowRes, payablesRes, revenueRes] = await Promise.all([
      fetch(`/api/stores/${storeId}/finance/entries`),
      fetch(`/api/stores/${storeId}/finance/accounts`),
      fetch(`/api/stores/${storeId}/finance/reports?kind=cashFlow`),
      fetch(`/api/stores/${storeId}/finance/reports?kind=payablesReceivables`),
      fetch(`/api/stores/${storeId}/finance/reports?kind=revenueByChannel`),
    ]);
    setEntries(await entriesRes.json());
    setAccounts(await accountsRes.json());
    setCashFlow(await cashFlowRes.json());
    setPayables(await payablesRes.json());
    setRevenue(await revenueRes.json());
  }

  useEffect(() => {
    reload();
  }, [storeId]);

  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    const ok = await run(
      () =>
        fetch(`/api/stores/${storeId}/finance/accounts`, {
          method: "POST",
          body: JSON.stringify({ name: accountForm.name.trim(), initialBalanceCents: Number(accountForm.balance) || 0 }),
        }),
      "Conta criada!",
    );
    if (ok) {
      setAccountForm({ name: "", balance: "0" });
      reload();
    }
  }

  async function createEntry() {
    await run(async () => {
      const res = await fetch(`/api/stores/${storeId}/finance/entries`, {
        method: "POST",
        body: JSON.stringify({
          kind: form.kind,
          amountCents: Number(form.amountCents),
          description: form.description,
          dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
        }),
      });
      if (res.ok) { setForm({ kind: "EXPENSE", amountCents: "", description: "", dueDate: "" }); reload(); }
      return res;
    }, "Lançamento adicionado!");
  }

  const [editEntry, setEditEntry] = useState<{ id: string; description: string; amount: string } | null>(null);
  const [accountForm, setAccountForm] = useState({ name: "", balance: "0" });
  const [editAccount, setEditAccount] = useState<{ id: string; name: string } | null>(null);

  async function saveEntry() {
    if (!editEntry) return;
    await run(async () => {
      const res = await fetch(`/api/stores/${storeId}/finance/entries/${editEntry.id}`, {
        method: "PATCH",
        body: JSON.stringify({ description: editEntry.description, amountCents: Number(editEntry.amount) }),
      });
      if (res.ok) { setEditEntry(null); reload(); }
      return res;
    }, "Lançamento atualizado!");
  }

  async function removeEntry(entry: Entry) {
    if (!window.confirm(`Excluir o lançamento "${entry.description}"?`)) return;
    await run(async () => {
      const res = await fetch(`/api/stores/${storeId}/finance/entries/${entry.id}`, { method: "DELETE" });
      if (res.ok) reload();
      return res;
    }, "Lançamento excluído.");
  }

  async function saveAccount() {
    if (!editAccount) return;
    await run(async () => {
      const res = await fetch(`/api/stores/${storeId}/finance/accounts/${editAccount.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editAccount.name }),
      });
      if (res.ok) { setEditAccount(null); reload(); }
      return res;
    }, "Conta atualizada!");
  }

  async function removeAccount(account: Account) {
    if (!window.confirm(`Excluir a conta "${account.name}"?`)) return;
    await run(async () => {
      const res = await fetch(`/api/stores/${storeId}/finance/accounts/${account.id}`, { method: "DELETE" });
      if (res.ok) reload();
      return res;
    }, "Conta excluída.");
  }

  async function settle(entryId: string) {
    await run(async () => {
      const res = await fetch(`/api/stores/${storeId}/finance/entries/${entryId}`, {
        method: "PATCH",
        body: JSON.stringify({ paidAt: new Date().toISOString() }),
      });
      if (res.ok) reload();
      return res;
    }, "Marcado como pago!");
  }

  return (
    <main>
      <h1>Financeiro</h1>

      <section>
        <h2>Lancamentos manuais</h2>
        <ul>
          {entries.map((entry) => (
            <li key={entry.id}>
              <span className={`badge ${entry.kind === "INCOME" ? "ok" : "warn"}`}>{entry.kind === "INCOME" ? "Receita" : "Despesa"}</span>
              {editEntry?.id === entry.id ? (
                <>
                  <input value={editEntry.description} onChange={(e) => setEditEntry({ ...editEntry, description: e.target.value })} />
                  <input value={editEntry.amount} onChange={(e) => setEditEntry({ ...editEntry, amount: e.target.value })} placeholder="Valor em centavos" />
                </>
              ) : (
                <>
                  <span>{entry.description}</span> <strong>R$ {(entry.amountCents / 100).toFixed(2).replace(".", ",")}</strong>
                </>
              )}
              {entry.paidAt ? <span className="badge ok">pago</span> : <button type="button" disabled={busy} onClick={() => settle(entry.id)}>Marcar como pago</button>}
              <RowActions
                editing={editEntry?.id === entry.id}
                busy={busy}
                onEdit={() => setEditEntry({ id: entry.id, description: entry.description, amount: String(entry.amountCents) })}
                onSave={saveEntry}
                onCancel={() => setEditEntry(null)}
                onDelete={() => removeEntry(entry)}
              />
            </li>
          ))}
        </ul>
        <div>
          <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            <option value="EXPENSE">Despesa</option>
            <option value="INCOME">Receita</option>
          </select>
          <input placeholder="Descricao" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <input placeholder="Valor em centavos" value={form.amountCents} onChange={(e) => setForm({ ...form, amountCents: e.target.value })} />
          <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          <button disabled={busy} onClick={createEntry}>Adicionar</button>
        </div>
      </section>

      <section>
        <h2>Contas bancarias</h2>
        <ul>
          {accounts.map((account) => (
            <li key={account.id}>
              {editAccount?.id === account.id ? (
                <input value={editAccount.name} onChange={(e) => setEditAccount({ ...editAccount, name: e.target.value })} />
              ) : (
                <>
                  <strong>{account.name}</strong> <span className="badge">saldo R$ {(account.balanceCents / 100).toFixed(2).replace(".", ",")}</span>
                </>
              )}
              <RowActions
                editing={editAccount?.id === account.id}
                busy={busy}
                onEdit={() => setEditAccount({ id: account.id, name: account.name })}
                onSave={saveAccount}
                onCancel={() => setEditAccount(null)}
                onDelete={() => removeAccount(account)}
              />
            </li>
          ))}
        </ul>
        <form onSubmit={createAccount}>
          <input placeholder="Nome da conta" value={accountForm.name} onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })} required />
          <input placeholder="Saldo inicial em centavos" inputMode="numeric" value={accountForm.balance} onChange={(e) => setAccountForm({ ...accountForm, balance: e.target.value })} />
          <button type="submit" disabled={busy}>Adicionar conta</button>
        </form>
      </section>

      <FinanceCategories storeId={storeId} />

      <section>
        <h2>Fluxo de caixa</h2>
        <table>
          <tbody>
            {cashFlow.map((row, i) => (
              <tr key={i}>
                <td>{row.bankAccountId ?? "sem conta"}</td>
                <td>R$ {((row.totalCents ?? 0) / 100).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Contas a pagar/receber</h2>
        <table>
          <tbody>
            {payables.map((row, i) => (
              <tr key={i}>
                <td>{row.description}</td>
                <td>R$ {((row.amountCents ?? 0) / 100).toFixed(2)}</td>
                <td><span className={`badge ${row.overdue ? "warn" : "ok"}`}>{row.overdue ? "vencido" : "em dia"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Receita por canal</h2>
        <table>
          <tbody>
            {revenue.map((row, i) => (
              <tr key={i}>
                <td>{row.channel}</td>
                <td>R$ {((row.totalCents ?? 0) / 100).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <Feedback msg={msg} />
    </main>
  );
}
