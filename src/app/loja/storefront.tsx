"use client";

import { useEffect, useMemo, useState } from "react";
import { calculateItemPrice } from "@/lib/menu/pricing";
import type { Product, ProductAddon } from "@prisma/client";

type Addon = { id: string; groupName: string; name: string; priceCents: number; required: boolean; multiple: boolean };
type PubProduct = { id: string; name: string; description: string; priceCents: number | null; pricePerKg: boolean; addons: Addon[] };
type Menu = {
  store: { name: string; open: boolean; estimatedDeliveryMinutes: number | null };
  categories: { id: string; name: string; products: PubProduct[] }[];
  zones: { id: string; name: string; feeCents: number }[];
};
type Line = { key: string; productId: string; name: string; quantity: number; weightGrams?: number; selectedAddonIds: string[]; addonNames: string[]; totalCents: number };

const brl = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

// Mesmo calculo do servidor, so para exibir; o servidor recalcula tudo ao criar o pedido.
function priceOf(p: PubProduct, quantity: number, weightGrams: number | undefined, selected: string[]): number {
  const addons = p.addons.map((a) => ({ ...a, active: true })) as unknown as ProductAddon[];
  return calculateItemPrice({ ...p, active: true } as unknown as Product, addons, { productId: p.id, quantity, weightGrams, selectedAddonIds: selected });
}

function requiredMissing(p: PubProduct, selected: string[]): string | null {
  const groups = new Map<string, Addon[]>();
  p.addons.forEach((a) => groups.set(a.groupName, [...(groups.get(a.groupName) ?? []), a]));
  for (const [name, list] of groups) {
    if (list.some((a) => a.required) && !list.some((a) => selected.includes(a.id))) return `Escolha uma opção em "${name}"`;
  }
  return null;
}

export default function Storefront() {
  const [menu, setMenu] = useState<Menu | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Line[]>([]);
  const [product, setProduct] = useState<PubProduct | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const cartKey = typeof window === "undefined" ? "" : `shop-cart:${window.location.host}`;

  useEffect(() => {
    fetch("/api/public/menu")
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 404 ? "Loja não encontrada" : "Não foi possível carregar o cardápio");
        setMenu(await res.json());
      })
      .catch((e: Error) => setError(e.message));
    try {
      const saved = localStorage.getItem(cartKey);
      if (saved) setCart(JSON.parse(saved));
    } catch {}
  }, [cartKey]);

  function saveCart(next: Line[]) {
    setCart(next);
    try {
      localStorage.setItem(cartKey, JSON.stringify(next));
    } catch {}
  }

  const filtered = useMemo(() => {
    if (!menu) return [];
    const q = query.trim().toLowerCase();
    return menu.categories
      .map((c) => ({ ...c, products: c.products.filter((p) => !q || `${p.name} ${p.description}`.toLowerCase().includes(q)) }))
      .filter((c) => c.products.length > 0);
  }, [menu, query]);

  if (error) return <div className="shop"><p className="shop-empty">{error}</p></div>;
  if (!menu) return <div className="shop"><p className="shop-empty">Carregando cardápio...</p></div>;

  const count = cart.reduce((n, l) => n + l.quantity, 0);
  const subtotal = cart.reduce((n, l) => n + l.totalCents, 0);

  return (
    <div className="shop">
      <header className="shop-header">
        <h1>{menu.store.name}</h1>
        <p>
          <span className={`badge ${menu.store.open ? "ok" : "off"}`}>{menu.store.open ? "Aberto" : "Fechado"}</span>
          {menu.store.estimatedDeliveryMinutes != null && <span className="shop-eta">🕒 {menu.store.estimatedDeliveryMinutes} min</span>}
        </p>
      </header>
      {!menu.store.open && <div className="shop-closed">A loja está fechada agora. Você pode ver o cardápio, mas não é possível finalizar pedidos.</div>}

      <div className="shop-bar">
        <input type="search" placeholder="Buscar no cardápio" value={query} onChange={(e) => setQuery(e.target.value)} />
        <nav className="shop-chips">
          {filtered.map((c) => (
            <a key={c.id} href={`#cat-${c.id}`}>{c.name}</a>
          ))}
        </nav>
      </div>

      <div className="shop-list">
        {filtered.length === 0 && <p className="shop-empty">Nenhum produto encontrado.</p>}
        {filtered.map((c) => (
          <section key={c.id} id={`cat-${c.id}`} className="shop-cat">
            <h2>{c.name}</h2>
            {c.products.map((p) => (
              <button type="button" key={p.id} className="shop-product" onClick={() => setProduct(p)}>
                <span className="shop-product-info">
                  <strong>{p.name}</strong>
                  {p.description && <small>{p.description}</small>}
                </span>
                <span className="shop-price">{brl(p.priceCents ?? 0)}{p.pricePerKg ? "/kg" : ""}</span>
              </button>
            ))}
          </section>
        ))}
      </div>

      {count > 0 && (
        <button type="button" className="shop-cartbar" onClick={() => setCartOpen(true)}>
          <span>🛒 Ver carrinho ({count})</span>
          <strong>{brl(subtotal)}</strong>
        </button>
      )}

      {product && (
        <ProductModal
          product={product}
          onClose={() => setProduct(null)}
          onAdd={(line) => {
            saveCart([...cart, line]);
            setProduct(null);
          }}
        />
      )}
      {cartOpen && (
        <CartSheet
          menu={menu}
          cart={cart}
          onChange={saveCart}
          onClose={() => setCartOpen(false)}
        />
      )}
    </div>
  );
}

function ProductModal({ product, onClose, onAdd }: { product: PubProduct; onClose: () => void; onAdd: (l: Line) => void }) {
  const [quantity, setQuantity] = useState(1);
  const [weight, setWeight] = useState("500");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const groups = useMemo(() => {
    const m = new Map<string, Addon[]>();
    product.addons.forEach((a) => m.set(a.groupName, [...(m.get(a.groupName) ?? []), a]));
    return [...m.entries()];
  }, [product]);

  const grams = product.pricePerKg ? Number(weight) : undefined;
  let total = 0;
  try {
    total = priceOf(product, product.pricePerKg ? 1 : quantity, grams, selected);
  } catch {
    total = 0;
  }

  function toggle(a: Addon, list: Addon[]) {
    setSelected((cur) => {
      if (cur.includes(a.id)) return cur.filter((id) => id !== a.id);
      const multiple = list.some((x) => x.multiple);
      return multiple ? [...cur, a.id] : [...cur.filter((id) => !list.some((x) => x.id === id)), a.id];
    });
  }

  function add() {
    if (product.pricePerKg && !(grams && grams > 0)) return setError("Informe o peso em gramas");
    const missing = requiredMissing(product, selected);
    if (missing) return setError(missing);
    const q = product.pricePerKg ? 1 : quantity;
    onAdd({
      key: `${product.id}-${Date.now()}`,
      productId: product.id,
      name: product.name,
      quantity: q,
      weightGrams: grams,
      selectedAddonIds: selected,
      addonNames: product.addons.filter((a) => selected.includes(a.id)).map((a) => a.name),
      totalCents: priceOf(product, q, grams, selected),
    });
  }

  return (
    <div className="shop-overlay" onClick={onClose}>
      <div className="shop-sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2>{product.name}</h2>
        {product.description && <p className="shop-muted">{product.description}</p>}

        {groups.map(([name, list]) => (
          <fieldset key={name} className="shop-group">
            <legend>{name}{list.some((a) => a.required) ? " (obrigatório)" : ""}{list.some((a) => a.multiple) ? " · vários" : ""}</legend>
            {list.map((a) => (
              <label key={a.id} className="shop-option">
                <input
                  type={list.some((x) => x.multiple) ? "checkbox" : "radio"}
                  name={name}
                  checked={selected.includes(a.id)}
                  onChange={() => toggle(a, list)}
                />
                <span>{a.name}</span>
                {a.priceCents > 0 && <small>+ {brl(a.priceCents)}</small>}
              </label>
            ))}
          </fieldset>
        ))}

        {product.pricePerKg ? (
          <label>
            Peso (gramas)
            <input type="number" min={1} step={50} value={weight} onChange={(e) => setWeight(e.target.value)} />
          </label>
        ) : (
          <div className="shop-qty">
            <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label="Menos">−</button>
            <strong>{quantity}</strong>
            <button type="button" onClick={() => setQuantity((q) => Math.min(50, q + 1))} aria-label="Mais">+</button>
          </div>
        )}

        {error && <p role="alert">{error}</p>}
        <button type="button" className="shop-primary" onClick={add}>Adicionar · {brl(total)}</button>
      </div>
    </div>
  );
}

function CartSheet({ menu, cart, onChange, onClose }: { menu: Menu; cart: Line[]; onChange: (c: Line[]) => void; onClose: () => void }) {
  const [form, setForm] = useState({
    customerName: "", phone: "", fulfillment: "DELIVERY", zoneId: "", street: "", number: "", complement: "",
    paymentMethod: "PIX", changeFor: "", notes: "", couponCode: "",
  });
  const [discount, setDiscount] = useState(0);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const subtotal = cart.reduce((n, l) => n + l.totalCents, 0);
  const zone = menu.zones.find((z) => z.id === form.zoneId);
  const fee = form.fulfillment === "DELIVERY" ? zone?.feeCents ?? 0 : 0;
  const total = subtotal - discount + fee;

  async function applyCoupon() {
    setCouponMsg(null);
    const res = await fetch("/api/public/validate-coupon", {
      method: "POST",
      body: JSON.stringify({ code: form.couponCode, subtotalCents: subtotal }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setDiscount(0);
      return setCouponMsg(data.error ?? "Cupom inválido");
    }
    setDiscount(data.discountCents);
    setCouponMsg(`Desconto de ${brl(data.discountCents)} aplicado`);
  }

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/public/orders", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          couponCode: discount > 0 ? form.couponCode : undefined,
          items: cart.map((l) => ({ productId: l.productId, quantity: l.quantity, weightGrams: l.weightGrams, selectedAddonIds: l.selectedAddonIds })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error ?? `Erro ${res.status}`);
      onChange([]);
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- navegacao completa apos o pedido
      window.location.href = `/loja/pedido/${data.id}?phone=${encodeURIComponent(form.phone)}`;
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shop-overlay" onClick={onClose}>
      <div className="shop-sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2>Seu pedido</h2>
        {cart.map((l) => (
          <div key={l.key} className="shop-line">
            <span>
              {l.quantity}x {l.name}{l.weightGrams ? ` (${l.weightGrams} g)` : ""}
              {l.addonNames.length > 0 && <small> + {l.addonNames.join(", ")}</small>}
            </span>
            <span>{brl(l.totalCents)}</span>
            <button type="button" className="shop-remove" onClick={() => onChange(cart.filter((x) => x.key !== l.key))} aria-label="Remover">✕</button>
          </div>
        ))}
        {cart.length === 0 && <p className="shop-empty">Carrinho vazio.</p>}

        <div className="shop-form">
          <label>Nome<input value={form.customerName} onChange={(e) => set("customerName", e.target.value)} /></label>
          <label>Telefone (WhatsApp)<input inputMode="tel" placeholder="(11) 99999-9999" value={form.phone} onChange={(e) => set("phone", e.target.value)} /></label>

          <div className="shop-toggle">
            <button type="button" className={form.fulfillment === "DELIVERY" ? "on" : ""} onClick={() => set("fulfillment", "DELIVERY")}>Entrega</button>
            <button type="button" className={form.fulfillment === "PICKUP" ? "on" : ""} onClick={() => set("fulfillment", "PICKUP")}>Retirada</button>
          </div>

          {form.fulfillment === "DELIVERY" && (
            <>
              <label>
                Bairro
                <select value={form.zoneId} onChange={(e) => set("zoneId", e.target.value)}>
                  <option value="">Selecione</option>
                  {menu.zones.map((z) => <option key={z.id} value={z.id}>{z.name} — {brl(z.feeCents)}</option>)}
                </select>
              </label>
              <label>Rua<input value={form.street} onChange={(e) => set("street", e.target.value)} /></label>
              <div className="shop-row">
                <label>Número<input value={form.number} onChange={(e) => set("number", e.target.value)} /></label>
                <label>Complemento<input value={form.complement} onChange={(e) => set("complement", e.target.value)} /></label>
              </div>
            </>
          )}

          <label>
            Pagamento
            <select value={form.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value)}>
              <option value="PIX">PIX</option>
              <option value="CARTAO">Cartão na entrega</option>
              <option value="DINHEIRO">Dinheiro</option>
            </select>
          </label>
          {form.paymentMethod === "DINHEIRO" && (
            <label>Troco para (R$, opcional)<input inputMode="decimal" value={form.changeFor} onChange={(e) => set("changeFor", e.target.value)} /></label>
          )}

          <div className="shop-row">
            <label>Cupom<input value={form.couponCode} onChange={(e) => set("couponCode", e.target.value)} /></label>
            <button type="button" className="btn-ghost" onClick={applyCoupon} disabled={!form.couponCode}>Aplicar</button>
          </div>
          {couponMsg && <p className="shop-muted">{couponMsg}</p>}

          <label>Observações<input value={form.notes} onChange={(e) => set("notes", e.target.value)} /></label>
        </div>

        <div className="shop-summary">
          <div><span>Subtotal</span><span>{brl(subtotal)}</span></div>
          {discount > 0 && <div><span>Desconto</span><span>− {brl(discount)}</span></div>}
          {form.fulfillment === "DELIVERY" && <div><span>Entrega</span><span>{zone ? brl(fee) : "—"}</span></div>}
          <div className="total"><span>Total</span><span>{brl(total)}</span></div>
        </div>

        {!menu.store.open && <p role="alert">Loja fechada: não é possível finalizar o pedido agora.</p>}
        {error && <p role="alert">{error}</p>}
        <button type="button" className="shop-primary" disabled={busy || cart.length === 0 || !menu.store.open} onClick={submit}>
          {busy ? "Enviando..." : "Fazer pedido"}
        </button>
        <button type="button" className="btn-ghost" onClick={onClose}>Continuar comprando</button>
      </div>
    </div>
  );
}
