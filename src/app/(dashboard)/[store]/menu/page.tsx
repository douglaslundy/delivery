import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";

async function MenuList() {
  const session = await getServerSession(authOptions);
  const storeId = (session as unknown as { storeId: string | null })?.storeId;

  if (!storeId) {
    return <p>Selecione uma loja para ver o cardapio.</p>;
  }

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
                {product.active ? "ativo" : "inativo"}
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
                {product.active ? "ativo" : "inativo"}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

export default function MenuPage() {
  return (
    <main>
      <h1>Cardapio</h1>
      <a href="./menu/novo">Novo produto</a>
      <Suspense fallback={<p>Carregando...</p>}>
        <MenuList />
      </Suspense>
    </main>
  );
}
