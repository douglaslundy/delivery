"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Feedback, useAction } from "../../feedback";
import AddonsSection from "./addons-section";

export default function ProductForm() {
  const params = useParams<{ store: string; productId: string }>();
  const isNew = params.productId === "novo";
  const storeId = params.store;

  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [pricePerKg, setPricePerKg] = useState(false);
  const [priceCents, setPriceCents] = useState("");
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const router = useRouter();
  const { busy, msg, run } = useAction();

  useEffect(() => {
    fetch(`/api/stores/${storeId}/categories`).then((r) => r.json()).then(setCategories);
    if (!isNew) {
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

    const body = {
      name,
      categoryId: categoryId || undefined,
      pricePerKg,
      priceCents: Number(priceCents),
    };

    const url = isNew ? `/api/stores/${storeId}/products` : `/api/stores/${storeId}/products/${params.productId}`;
    const ok = await run(() => fetch(url, { method: isNew ? "POST" : "PATCH", body: JSON.stringify(body) }), isNew ? "Produto cadastrado!" : "Salvo!");
    if (ok && isNew) router.push(`/${storeId}/menu`);
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
        <Feedback msg={msg} />
        <button type="submit" disabled={busy}>{busy ? "Salvando..." : "Salvar"}</button>
      </form>

      {!isNew && (
        <AddonsSection storeId={storeId} productId={params.productId} />
      )}
    </main>
  );
}
