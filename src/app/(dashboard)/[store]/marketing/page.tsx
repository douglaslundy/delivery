"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Coupon = { id: string; code: string; kind: string; value: number; active: boolean };

export default function MarketingPage() {
  const params = useParams<{ store: string }>();
  const storeId = params.store;

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [couponForm, setCouponForm] = useState({ code: "", kind: "PERCENT", value: "" });
  const [cashbackCustomerId, setCashbackCustomerId] = useState("");
  const [cashbackBalance, setCashbackBalance] = useState<number | null>(null);
  const [loyalty, setLoyalty] = useState({ pointsPerCurrencyUnit: "1", redemptionRuleCents: "" });

  async function reloadCoupons() {
    const res = await fetch(`/api/stores/${storeId}/coupons`);
    setCoupons(await res.json());
  }

  useEffect(() => {
    reloadCoupons();
  }, [storeId]);

  async function createCoupon() {
    await fetch(`/api/stores/${storeId}/coupons`, {
      method: "POST",
      body: JSON.stringify({ code: couponForm.code, kind: couponForm.kind, value: Number(couponForm.value) }),
    });
    setCouponForm({ code: "", kind: "PERCENT", value: "" });
    reloadCoupons();
  }

  async function lookupCashback() {
    const res = await fetch(`/api/stores/${storeId}/cashback?customerId=${encodeURIComponent(cashbackCustomerId)}`);
    const data = await res.json();
    setCashbackBalance(data.balanceCents ?? 0);
  }

  async function saveLoyalty() {
    await fetch(`/api/stores/${storeId}/loyalty`, {
      method: "PUT",
      body: JSON.stringify({
        pointsPerCurrencyUnit: Number(loyalty.pointsPerCurrencyUnit),
        redemptionRuleCents: Number(loyalty.redemptionRuleCents),
      }),
    });
  }

  return (
    <main>
      <h1>Marketing</h1>

      <section>
        <h2>Cupons</h2>
        <ul>
          {coupons.map((coupon) => (
            <li key={coupon.id}>
              {coupon.code} — {coupon.kind} {coupon.value} — {coupon.active ? "ativo" : "inativo"}
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
          <button onClick={createCoupon}>Criar cupom</button>
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
        <button onClick={saveLoyalty}>Salvar</button>
      </section>
    </main>
  );
}
