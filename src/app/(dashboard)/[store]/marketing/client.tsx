"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Feedback, useAction } from "../feedback";
import RowActions from "../row-actions";

type Coupon = { id: string; code: string; kind: string; value: number; active: boolean };

export default function MarketingPageClient() {
  const params = useParams<{ store: string }>();
  const storeId = params.store;

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [couponForm, setCouponForm] = useState({ code: "", kind: "PERCENT", value: "" });
  const [cashbackCustomerId, setCashbackCustomerId] = useState("");
  const [cashbackBalance, setCashbackBalance] = useState<number | null>(null);
  const [loyalty, setLoyalty] = useState({ pointsPerCurrencyUnit: "1", redemptionRuleCents: "" });
  const { busy, msg, run } = useAction();

  async function reloadCoupons() {
    const res = await fetch(`/api/stores/${storeId}/coupons`);
    setCoupons(await res.json());
  }

  useEffect(() => {
    reloadCoupons();
  }, [storeId]);

  async function createCoupon() {
    await run(async () => {
      const res = await fetch(`/api/stores/${storeId}/coupons`, {
        method: "POST",
        body: JSON.stringify({ code: couponForm.code, kind: couponForm.kind, value: Number(couponForm.value) }),
      });
      if (res.ok) { setCouponForm({ code: "", kind: "PERCENT", value: "" }); reloadCoupons(); }
      return res;
    }, "Cupom criado!");
  }

  async function lookupCashback() {
    const res = await fetch(`/api/stores/${storeId}/cashback?customerId=${encodeURIComponent(cashbackCustomerId)}`);
    const data = await res.json();
    setCashbackBalance(data.balanceCents ?? 0);
  }

  async function saveLoyalty() {
    await run(
      () =>
        fetch(`/api/stores/${storeId}/loyalty`, {
          method: "PUT",
          body: JSON.stringify({
            pointsPerCurrencyUnit: Number(loyalty.pointsPerCurrencyUnit),
            redemptionRuleCents: Number(loyalty.redemptionRuleCents),
          }),
        }),
      "Programa salvo!",
    );
  }

  const [editCoupon, setEditCoupon] = useState<{ id: string; value: string; active: boolean } | null>(null);

  async function saveCoupon() {
    if (!editCoupon) return;
    const ok = await run(
      () =>
        fetch(`/api/stores/${storeId}/coupons/${editCoupon.id}`, {
          method: "PATCH",
          body: JSON.stringify({ value: Number(editCoupon.value), active: editCoupon.active }),
        }),
      "Cupom atualizado!",
    );
    if (ok) {
      setEditCoupon(null);
      reloadCoupons();
    }
  }

  async function removeCoupon(coupon: Coupon) {
    if (!window.confirm(`Excluir o cupom "${coupon.code}"?`)) return;
    if (await run(() => fetch(`/api/stores/${storeId}/coupons/${coupon.id}`, { method: "DELETE" }), "Cupom excluído.")) {
      reloadCoupons();
    }
  }

  return (
    <main>
      <h1>Marketing</h1>

      <section>
        <h2>Cupons</h2>
        <ul>
          {coupons.map((coupon) => (
            <li key={coupon.id}>
              <strong>{coupon.code}</strong>
              {editCoupon?.id === coupon.id ? (
                <>
                  <input value={editCoupon.value} onChange={(e) => setEditCoupon({ ...editCoupon, value: e.target.value })} placeholder={coupon.kind === "PERCENT" ? "%" : "centavos"} />
                  <label>
                    <input type="checkbox" checked={editCoupon.active} onChange={(e) => setEditCoupon({ ...editCoupon, active: e.target.checked })} />
                    ativo
                  </label>
                </>
              ) : (
                <>
                  <span>{coupon.kind === "PERCENT" ? `${coupon.value}%` : `R$ ${(coupon.value / 100).toFixed(2).replace(".", ",")}`}</span> <span className={`badge ${coupon.active ? "ok" : "off"}`}>{coupon.active ? "ativo" : "inativo"}</span>
                </>
              )}
              <RowActions
                editing={editCoupon?.id === coupon.id}
                busy={busy}
                onEdit={() => setEditCoupon({ id: coupon.id, value: String(coupon.value), active: coupon.active })}
                onSave={saveCoupon}
                onCancel={() => setEditCoupon(null)}
                onDelete={() => removeCoupon(coupon)}
              />
            </li>
          ))}
        </ul>
        <div>
          <input placeholder="Codigo" value={couponForm.code} onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value })} />
          <select value={couponForm.kind} onChange={(e) => setCouponForm({ ...couponForm, kind: e.target.value })}>
            <option value="PERCENT">Percentual</option>
            <option value="FIXED">Fixo</option>
          </select>
          <input placeholder="Valor" value={couponForm.value} onChange={(e) => setCouponForm({ ...couponForm, value: e.target.value })} />
          <button disabled={busy} onClick={createCoupon}>Criar cupom</button>
        </div>
      </section>

      <section>
        <h2>Cashback</h2>
        <input placeholder="ID do cliente" value={cashbackCustomerId} onChange={(e) => setCashbackCustomerId(e.target.value)} />
        <button onClick={lookupCashback}>Consultar saldo</button>
        {cashbackBalance !== null && <p>Saldo: R$ {(cashbackBalance / 100).toFixed(2)}</p>}
      </section>

      <section>
        <h2>Programa de fidelidade</h2>
        <input placeholder="Pontos por R$1" value={loyalty.pointsPerCurrencyUnit} onChange={(e) => setLoyalty({ ...loyalty, pointsPerCurrencyUnit: e.target.value })} />
        <input placeholder="Centavos de desconto por 100 pontos" value={loyalty.redemptionRuleCents} onChange={(e) => setLoyalty({ ...loyalty, redemptionRuleCents: e.target.value })} />
        <button disabled={busy} onClick={saveLoyalty}>Salvar</button>
      </section>
      <Feedback msg={msg} />
    </main>
  );
}
