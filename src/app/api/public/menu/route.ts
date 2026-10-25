import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolvePublicStore } from "@/lib/storefront/publicStore";
import { isStoreOpen } from "@/lib/storefront/hours";

export async function GET(request: Request) {
  const resolved = await resolvePublicStore(request);
  if ("response" in resolved) return resolved.response;
  const { store } = resolved;

  const [categories, uncategorized, zones] = await Promise.all([
    prisma.category.findMany({
      where: { storeId: store.id, active: true },
      orderBy: { position: "asc" },
      include: {
        products: {
          where: { active: true },
          orderBy: { position: "asc" },
          include: { addons: { where: { active: true }, orderBy: { position: "asc" } } },
        },
      },
    }),
    prisma.product.findMany({
      where: { storeId: store.id, categoryId: null, active: true },
      orderBy: { position: "asc" },
      include: { addons: { where: { active: true }, orderBy: { position: "asc" } } },
    }),
    prisma.deliveryZone.findMany({ where: { storeId: store.id }, orderBy: { name: "asc" } }),
  ]);

  // So campos publicos: nada de storeId, descricao de IA, etc.
  const pub = (p: (typeof uncategorized)[number]) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    priceCents: p.priceCents,
    pricePerKg: p.pricePerKg,
    addons: p.addons.map((a) => ({
      id: a.id,
      groupName: a.groupName,
      name: a.name,
      priceCents: a.priceCents,
      required: a.required,
      multiple: a.multiple,
    })),
  });

  const groups = categories.map((c) => ({ id: c.id, name: c.name, products: c.products.map(pub) }));
  if (uncategorized.length > 0) groups.push({ id: "outros", name: "Outros", products: uncategorized.map(pub) });

  return NextResponse.json({
    store: {
      name: store.name,
      open: isStoreOpen(store.businessHours, store.timezone),
      estimatedDeliveryMinutes: store.estimatedDeliveryMinutes,
      businessHours: store.businessHours,
    },
    categories: groups.filter((g) => g.products.length > 0),
    zones: zones.map((z) => ({ id: z.id, name: z.name, feeCents: z.feeCents })),
  });
}
