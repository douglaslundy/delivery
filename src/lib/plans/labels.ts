// Sem imports de servidor: usado tambem por componentes client.
export type PlanResource = "orders" | "products" | "customers" | "categories" | "members" | "deliveryPeople";
export type PlanFeature = "whatsappBot" | "pdv" | "tables" | "finance" | "marketing" | "fiscal" | "delivery";

export const RESOURCE_LABEL: Record<PlanResource, string> = {
  orders: "pedidos no mês",
  products: "produtos",
  customers: "clientes",
  categories: "categorias",
  members: "usuários",
  deliveryPeople: "entregadores",
};

export const FEATURE_LABEL: Record<PlanFeature, string> = {
  whatsappBot: "WhatsApp e bot",
  pdv: "PDV",
  tables: "Mesas",
  finance: "Financeiro",
  marketing: "Marketing",
  fiscal: "Fiscal",
  delivery: "Entregas",
};
