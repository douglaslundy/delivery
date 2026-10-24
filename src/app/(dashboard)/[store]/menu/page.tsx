import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import DeleteProduct from "./delete-product";

async function MenuList({ params }: { params: Promise<{ store: string }> }) {
  const { store: storeId } = await params;

  const categories = await prisma.category.findMany({
    where: { storeId },
    orderBy: { position: "asc" },
    include: { products: { orderBy: { position: "asc" } } },
  });

  const uncategorized = await prisma.product.findMany({
    where: { storeId, categoryId: null },
    orderBy: { position: "asc" },
  });

  return (
    <>
      {categories.map((category) => (
        <section key={category.id}>
          <h2>{category.name}</h2>
          <ul>
            {category.products.map((product) => (
              <li key={product.id}>
                <a href={`./menu/${product.id}`}>{product.name}</a>{" "}
                <span className={`badge ${product.active ? "ok" : "off"}`}>{product.active ? "ativo" : "inativo"}</span>
                <span className="item-actions">
                  <a href={`./menu/${product.id}`} className="badge">Editar</a>
                  <DeleteProduct storeId={storeId} productId={product.id} name={product.name} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {uncategorized.length > 0 && (
        <section>
          <h2>Sem categoria</h2>
          <ul>
            {uncategorized.map((product) => (
              <li key={product.id}>
                <a href={`./menu/${product.id}`}>{product.name}</a>{" "}
                <span className={`badge ${product.active ? "ok" : "off"}`}>{product.active ? "ativo" : "inativo"}</span>
                <span className="item-actions">
                  <a href={`./menu/${product.id}`} className="badge">Editar</a>
                  <DeleteProduct storeId={storeId} productId={product.id} name={product.name} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

export default function MenuPage({ params }: { params: Promise<{ store: string }> }) {
  return (
    <main>
      <h1>Cardápio</h1>
      <a href="./menu/novo">+ Novo produto</a>{" "}
      <a href="./categorias" style={{ background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)" }}>Gerenciar categorias</a>
      <Suspense fallback={<p>Carregando...</p>}>
        <MenuList params={params} />
      </Suspense>
    </main>
  );
}
