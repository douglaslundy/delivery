"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Product as DbProduct, ProductAddon } from "@prisma/client";
import { calculateItemPrice, type LineItemSelection } from "@/lib/menu/pricing";
import { Feedback, useAction } from "../feedback";

type Product = DbProduct;
type Category = { id: string; name: string };
type Order = { id: string; channel: string; status: string; tableNumber: string | null };
type Target = { channel: "SALAO" | "PDV"; tableNumber?: string };

const brl = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
const CLOSED = ["COMPLETED", "CANCELED"];
const PAYMENTS = [
  ["CASH", "Dinheiro"],
  ["PIX", "Pix"],
  ["CREDIT_CARD", "Cartão de crédito"],
  ["DEBIT_CARD", "Cartão de débito"],
];

export default function MesasClient() {
  const { store: storeId } = useParams<{ store: string }>();
  const [settings, setSettings] = useState<{ tableCount: number | null; hasPdv: boolean } | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [target, setTarget] = useState<Target | null>(null);
  const [cart, setCart] = useState<LineItemSelection[]>([]);
  const [addonCache, setAddonCache] = useState<Record<string, ProductAddon[]>>({});
  const [picker, setPicker] = useState<{ product: Product; weight: string; selected: string[] } | null>(null);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [payment, setPayment] = useState("CASH");
  const { busy, msg, run } = useAction();

  const loadOrders = useCallback(async () => {
    const res = await fetch(`/api/stores/${storeId}/orders?status=active`);
    if (res.ok) setOrders(await res.json());
  }, [storeId]);

  useEffect(() => {
    fetch(`/api/stores/${storeId}/settings`).then((r) => (r.ok ? r.json() : null)).then(setSettings);
    fetch(`/api/stores/${storeId}/products?active=true`).then((r) => (r.ok ? r.json() : [])).then(setProducts);
    fetch(`/api/stores/${storeId}/categories`).then((r) => (r.ok ? r.json() : [])).then(setCategories);
    loadOrders();
    const timer = setInterval(loadOrders, 5000);
    return () => clearInterval(timer);
  }, [storeId, loadOrders]);

  const configured = settings && ((settings.tableCount ?? 0) > 0 || settings.hasPdv);
  const busyTables = new Set(orders.filter((o) => o.channel === "SALAO" && !CLOSED.includes(o.status)).map((o) => o.tableNumber));

  const sellable = products.filter((p) => p.active && p.priceCents != null);
  const productOf = (id: string) => products.find((p) => p.id === id);

  // Mesmo calculo do servidor (precos, kg, regras de adicionais obrigatorios/multiplos).
  function linePrice(line: LineItemSelection): number {
    const product = productOf(line.productId);
    if (!product) return 0;
    try {
      return calculateItemPrice(product, addonCache[line.productId] ?? [], line);
    } catch {
      return 0;
    }
  }
  const total = cart.reduce((sum, line) => sum + linePrice(line), 0);

  async function loadAddons(productId: string): Promise<ProductAddon[]> {
    if (addonCache[productId]) return addonCache[productId];
    const res = await fetch(`/api/stores/${storeId}/products/${productId}/addons`);
    const grouped: Record<string, ProductAddon[]> = res.ok ? await res.json() : {};
    const list = Object.values(grouped).flat();
    setAddonCache((c) => ({ ...c, [productId]: list }));
    return list;
  }

  async function pick(product: Product) {
    const addons = (await loadAddons(product.id)).filter((a) => a.active);
    if (!product.pricePerKg && addons.length === 0) {
      setCart((c) => [...c, { productId: product.id, quantity: 1, selectedAddonIds: [] }]);
      return;
    }
    setPickerError(null);
    setPicker({ product, weight: "", selected: [] });
  }

  function confirmPicker() {
    if (!picker) return;
    const line: LineItemSelection = {
      productId: picker.product.id,
      quantity: 1,
      weightGrams: picker.product.pricePerKg ? Number(picker.weight) : undefined,
      selectedAddonIds: picker.selected,
    };
    try {
      calculateItemPrice(picker.product, addonCache[picker.product.id] ?? [], line);
    } catch (e) {
      setPickerError(e instanceof Error ? e.message : "Seleção inválida");
      return;
    }
    setCart((c) => [...c, line]);
    setPicker(null);
  }

  function toggleAddon(addon: ProductAddon, group: ProductAddon[]) {
    setPicker((p) => {
      if (!p) return p;
      const on = p.selected.includes(addon.id);
      const multiple = group.every((a) => a.multiple);
      const others = multiple ? p.selected : p.selected.filter((id) => !group.some((g) => g.id === id));
      return { ...p, selected: on ? p.selected.filter((id) => id !== addon.id) : [...others, addon.id] };
    });
  }

  const changeQty = (index: number, delta: number) =>
    setCart((c) =>
      c.flatMap((line, i) => {
        if (i !== index) return [line];
        const quantity = line.quantity + delta;
        return quantity > 0 ? [{ ...line, quantity }] : [];
      }),
    );

  async function finish() {
    if (!target || cart.length === 0) return;
    const ok = await run(
      () =>
        fetch(`/api/stores/${storeId}/orders`, {
          method: "POST",
          body: JSON.stringify({
            channel: target.channel,
            tableNumber: target.tableNumber,
            paymentMethod: payment,
            items: cart,
          }),
        }),
      "Pedido lançado!",
    );
    if (ok) {
      setCart([]);
      setTarget(null);
      loadOrders();
    }
  }

  if (target) {
    return (
      <main>
        <h1>{target.channel === "SALAO" ? `Mesa ${target.tableNumber}` : "Pedido de balcão (PDV)"}</h1>
        <p>Escolha os produtos e finalize o pedido.</p>
        <div className="pdv">
          <div>
            {[...categories, { id: "", name: "Sem categoria" }].map((cat) => {
              const list = sellable.filter((p) => (p.categoryId ?? "") === cat.id);
              if (list.length === 0) return null;
              return (
                <section key={cat.id || "none"}>
                  <h2>{cat.name}</h2>
                  <ul>
                    {list.map((p) => (
                      <li key={p.id}>
                        <span>{p.name}</span>
                        <span className="badge">{brl(p.priceCents ?? 0)}{p.pricePerKg ? "/kg" : ""}</span>
                        {p.pricePerKg && <span className="badge">por kg</span>}
                        <button type="button" style={{ marginLeft: "auto" }} onClick={() => pick(p)}>Adicionar</button>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
            {sellable.length === 0 && <p className="empty">Nenhum produto ativo no cardápio.</p>}
          </div>
          <aside>
            <section>
              <h2>Carrinho</h2>
              {picker && (
                <div className="card" style={{ marginBottom: 12 }}>
                  <strong>{picker.product.name}</strong>
                  {picker.product.pricePerKg && (
                    <label style={{ marginTop: 8 }}>
                      Peso (gramas)
                      <input inputMode="numeric" value={picker.weight} onChange={(e) => setPicker({ ...picker, weight: e.target.value })} />
                    </label>
                  )}
                  {Object.entries(
                    (addonCache[picker.product.id] ?? []).filter((a) => a.active).reduce<Record<string, ProductAddon[]>>((acc, a) => {
                      (acc[a.groupName] ??= []).push(a);
                      return acc;
                    }, {}),
                  ).map(([group, list]) => (
                    <div key={group}>
                      <h3>{group}{list.some((a) => a.required) ? " (obrigatório)" : ""}{list.every((a) => a.multiple) ? "" : " · escolha 1"}</h3>
                      {list.map((a) => (
                        <label key={a.id}>
                          <input
                            type={list.every((x) => x.multiple) ? "checkbox" : "radio"}
                            name={group}
                            checked={picker.selected.includes(a.id)}
                            onChange={() => toggleAddon(a, list)}
                          />
                          {a.name} {a.priceCents > 0 && `(+${brl(a.priceCents)})`}
                        </label>
                      ))}
                    </div>
                  ))}
                  {pickerError && <p role="alert">{pickerError}</p>}
                  <div className="actions">
                    <button type="button" onClick={confirmPicker}>Adicionar ao carrinho</button>
                    <button type="button" className="secondary" onClick={() => setPicker(null)}>Cancelar</button>
                  </div>
                </div>
              )}
              {cart.length === 0 ? (
                <p className="empty">Vazio</p>
              ) : (
                <ul>
                  {cart.map((line, i) => {
                    const product = productOf(line.productId);
                    const names = (addonCache[line.productId] ?? []).filter((a) => line.selectedAddonIds.includes(a.id)).map((a) => a.name);
                    return (
                      <li key={i}>
                        <span>
                          {line.weightGrams ? `${line.weightGrams} g` : `${line.quantity}×`} {product?.name}
                          {names.length > 0 && <span className="hint"> + {names.join(", ")}</span>}
                        </span>
                        {line.weightGrams ? (
                          <button type="button" className="secondary" onClick={() => changeQty(i, -1)}>Remover</button>
                        ) : (
                          <span style={{ display: "flex", gap: 6 }}>
                            <button type="button" className="secondary" onClick={() => changeQty(i, -1)}>−</button>
                            <button type="button" onClick={() => changeQty(i, 1)}>+</button>
                          </span>
                        )}
                        <span style={{ marginLeft: "auto" }}>{brl(linePrice(line))}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
              <label style={{ marginTop: 12 }}>
                Forma de pagamento
                <select value={payment} onChange={(e) => setPayment(e.target.value)}>
                  {PAYMENTS.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <p className="t-total" style={{ fontSize: 22, fontWeight: 750, margin: "12px 0" }}>Total: {brl(total)}</p>
              <Feedback msg={msg} />
              <div className="actions">
                <button type="button" disabled={busy || cart.length === 0} onClick={finish}>{busy ? "Enviando..." : "Finalizar"}</button>
                <button type="button" className="secondary" disabled={busy} onClick={() => { setTarget(null); setCart([]); setPicker(null); }}>Voltar</button>
              </div>
            </section>
          </aside>
        </div>
      </main>
    );
  }

  return (
    <main>
      <h1>Mesas e PDV</h1>
      <p>Lance pedidos de salão por mesa ou de balcão.</p>
      <Feedback msg={msg} />

      {settings && !configured && (
        <section>
          <p>Nenhuma mesa nem PDV configurado. Defina o número de mesas e ative o PDV em <Link href={`/${storeId}/settings`} style={{ color: "var(--primary)", fontWeight: 600 }}>Configurações</Link>.</p>
        </section>
      )}

      {settings?.hasPdv && (
        <div style={{ marginTop: 18 }}>
          <button type="button" onClick={() => setTarget({ channel: "PDV" })}>+ Novo pedido PDV / balcão</button>
        </div>
      )}

      {(settings?.tableCount ?? 0) > 0 && (
        <div className="tables">
          {Array.from({ length: settings?.tableCount ?? 0 }, (_, i) => String(i + 1)).map((n) => (
            <button key={n} type="button" className={`table-tile${busyTables.has(n) ? " busy" : ""}`} onClick={() => setTarget({ channel: "SALAO", tableNumber: n })}>
              Mesa {n}
              <small>{busyTables.has(n) ? "Ocupada" : "Livre"}</small>
            </button>
          ))}
        </div>
      )}
    </main>
  );
}
