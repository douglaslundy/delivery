"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Entry = { id: string; kind: string; amountCents: number; description: string; dueDate: string | null; paidAt: string | null };
type Account = { id: string; name: string; initialBalanceCents: number; balanceCents: number };
type Report = { bankAccountId?: string | null; channel?: string; totalCents?: number; description?: string; amountCents?: number; overdue?: boolean };

export default function FinanceiroPage() {
  const params = useParams<{ store: string }>();
  const storeId = params.store;

  const [entries, setEntries] = useState<Entry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cashFlow, setCashFlow] = useState<Report[]>([]);
  const [payables, setPayables] = useState<Report[]>([]);
  const [revenue, setRevenue] = useState<Report[]>([]);
  const [form, setForm] = useState({ kind: "EXPENSE", amountCents: "", description: "", dueDate: "" });

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

  async function createEntry() {
    await fetch(`/api/stores/${storeId}/finance/entries`, {
      method: "POST",
      body: JSON.stringify({
        kind: form.kind,
        amountCents: Number(form.amountCents),
        description: form.description,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
      }),
    });
    setForm({ kind: "EXPENSE", amountCents: "", description: "", dueDate: "" });
    reload();
  }

  async function settle(entryId: string) {
    await fetch(`/api/stores/${storeId}/finance/entries/${entryId}`, {
      method: "PATCH",
      body: JSON.stringify({ paidAt: new Date().toISOString() }),
    });
    reload();
  }

  return (
    <main>
      <h1>Financeiro</h1>

      <section>
        <h2>Lancamentos manuais</h2>
        <ul>
          {entries.map((entry) => (
            <li key={entry.id}>
              {entry.kind} — {entry.description} — R$ {(entry.amountCents / 100).toFixed(2)}{" "}
              {entry.paidAt ? "pago" : <button onClick={() => settle(entry.id)}>Marcar como pago</button>}
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
          <button onClick={createEntry}>Adicionar</button>
        </div>
      </section>

      <section>
        <h2>Contas bancarias</h2>
        <ul>
          {accounts.map((account) => (
            <li key={account.id}>
              {account.name} — saldo R$ {(account.balanceCents / 100).toFixed(2)}
            </li>
          ))}
        </ul>
      </section>

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
                <td>{row.overdue ? "vencido" : "em dia"}</td>
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
    </main>
  );
}
