"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Addon = { id: string; groupName: string; name: string; priceCents: number; required: boolean; multiple: boolean };

export default function ProductForm() {
  const params = useParams<{ store: string; productId: string }>();
  const isNew = params.productId === "novo";
  const storeId = params.store;

  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [pricePerKg, setPricePerKg] = useState(false);
  const [priceCents, setPriceCents] = useState("");
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [addons, setAddons] = useState<Record<string, Addon[]>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/stores/${storeId}/categories`).then((r) => r.json()).then(setCategories);
    if (!isNew) {
      fetch(`/api/stores/${storeId}/products/${params.productId}/addons`).then((r) => r.json()).then(setAddons);
      fetch(`/api/stores/${storeId}/products`)
        .then((r) => r.json())
        .then((products: { id: string; name: string; categoryId: string | null; pricePerKg: boolean; priceCents: number | null }[]) => {
          const product = products.find((p) => p.id === params.productId);
          if (product) {
            setName(product.name);
            setCategoryId(product.categoryId ?? "");
            setPricePerKg(product.pricePerKg);
            setPriceCents(product.priceCents != null ? String(product.priceCents) : "");
          }
        });
    }
  }, [storeId, isNew, params.productId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const body = {
      name,
      categoryId: categoryId || undefined,
      pricePerKg,
      priceCents: Number(priceCents),
    };

    const url = isNew ? `/api/stores/${storeId}/products` : `/api/stores/${storeId}/products/${params.productId}`;
    const res = await fetch(url, { method: isNew ? "POST" : "PATCH", body: JSON.stringify(body) });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "erro ao salvar");
    }
  }

  return (
    <main>
      <h1>{isNew ? "Novo produto" : "Editar produto"}</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Nome
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Categoria
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Sem categoria</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <fieldset>
          <label>
            <input type="radio" checked={!pricePerKg} onChange={() => setPricePerKg(false)} />
            Preco fixo
          </label>
          <label>
            <input type="radio" checked={pricePerKg} onChange={() => setPricePerKg(true)} />
            Por kg
          </label>
        </fieldset>
        <label>
          {pricePerKg ? "Preco por kg (centavos)" : "Preco (centavos)"}
          <input value={priceCents} onChange={(e) => setPriceCents(e.target.value)} />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit">Salvar</button>
      </form>

      {!isNew && (
        <section>
          <h2>Adicionais</h2>
          {Object.entries(addons).map(([groupName, group]) => (
            <div key={groupName}>
              <h3>{groupName}</h3>
              <ul>
                {group.map((a) => (
                  <li key={a.id}>{a.name} — {a.priceCents}c</li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
