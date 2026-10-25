import type { Store } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createOrder, type CreateOrderInput } from "@/lib/orders/createOrder";
import { isStoreOpen } from "@/lib/storefront/hours";

export class PublicOrderError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const PAYMENTS = ["DINHEIRO", "CARTAO", "PIX"] as const;
const MAX_ITEMS = 50;

// Telefone BR so com digitos e DDI 55 (DDD + 8/9 digitos). null = invalido.
export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let digits = raw.replace(/\D/g, "").replace(/^0+/, "");
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return /^55\d{10,11}$/.test(digits) ? digits : null;
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export type ParsedPublicOrder = {
  customerName: string;
  customerId: string;
  pickup: boolean;
  zoneId?: string;
  address?: { street: string; number: string; complement: string };
  paymentMethod: string;
  couponCode?: string;
  notes: string;
  items: { productId: string; quantity: number; weightGrams?: number; selectedAddonIds: string[] }[];
};

// Valida formato/limites do corpo. Precos NUNCA vem do cliente: so ids, quantidades e pesos.
export function parsePublicOrder(body: unknown): ParsedPublicOrder {
  const b = (body ?? {}) as Record<string, unknown>;

  const customerName = text(b.customerName, 80);
  if (!customerName) throw new PublicOrderError("Informe seu nome");
  const customerId = normalizePhone(b.phone);
  if (!customerId) throw new PublicOrderError("Telefone invalido (use DDD + numero)");

  const pickup = b.fulfillment === "PICKUP";
  if (!pickup && b.fulfillment !== "DELIVERY") throw new PublicOrderError("Escolha entrega ou retirada");

  let zoneId: string | undefined;
  let address: ParsedPublicOrder["address"];
  if (!pickup) {
    zoneId = text(b.zoneId, 60);
    if (!zoneId) throw new PublicOrderError("Escolha o bairro de entrega");
    address = { street: text(b.street, 120), number: text(b.number, 20), complement: text(b.complement, 80) };
    if (!address.street || !address.number) throw new PublicOrderError("Informe rua e numero");
  }

  const payment = text(b.paymentMethod, 20);
  if (!(PAYMENTS as readonly string[]).includes(payment)) throw new PublicOrderError("Forma de pagamento invalida");
  let paymentMethod = payment;
  if (payment === "DINHEIRO" && b.changeFor != null && b.changeFor !== "") {
    const change = Number(b.changeFor);
    if (!Number.isFinite(change) || change <= 0 || change > 100000) throw new PublicOrderError("Valor do troco invalido");
    paymentMethod = `DINHEIRO (troco para R$ ${change.toFixed(2).replace(".", ",")})`;
  }

  if (!Array.isArray(b.items) || b.items.length === 0) throw new PublicOrderError("O carrinho esta vazio");
  if (b.items.length > MAX_ITEMS) throw new PublicOrderError("Itens demais no pedido");
  const items = b.items.map((raw) => {
    const i = (raw ?? {}) as Record<string, unknown>;
    const productId = text(i.productId, 60);
    const quantity = Number(i.quantity);
    if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
      throw new PublicOrderError("Item invalido no carrinho");
    }
    let weightGrams: number | undefined;
    if (i.weightGrams != null) {
      weightGrams = Number(i.weightGrams);
      if (!Number.isInteger(weightGrams) || weightGrams < 1 || weightGrams > 20000) throw new PublicOrderError("Peso invalido");
    }
    const selectedAddonIds = Array.isArray(i.selectedAddonIds)
      ? [...new Set(i.selectedAddonIds.filter((x): x is string => typeof x === "string").slice(0, 50))]
      : [];
    return { productId, quantity, weightGrams, selectedAddonIds };
  });

  const couponCode = text(b.couponCode, 40) || undefined;
  return { customerName, customerId, pickup, zoneId, address, paymentMethod, couponCode, notes: text(b.notes, 300), items };
}

// Aplica as regras que dependem do banco e cria o pedido via createOrder (que recalcula todos os precos).
export async function createPublicOrder(store: Store, parsed: ParsedPublicOrder) {
  if (!isStoreOpen(store.businessHours, store.timezone)) {
    throw new PublicOrderError("A loja esta fechada no momento", 409);
  }

  // Produtos precisam existir, estar ativos e ser DESTA loja.
  const ids = [...new Set(parsed.items.map((i) => i.productId))];
  const found = await prisma.product.findMany({ where: { storeId: store.id, id: { in: ids }, active: true }, select: { id: true } });
  if (found.length !== ids.length) throw new PublicOrderError("Um item do carrinho nao esta mais disponivel");

  let deliveryFeeCents = 0;
  if (!parsed.pickup) {
    const zone = await prisma.deliveryZone.findFirst({ where: { storeId: store.id, id: parsed.zoneId } });
    if (!zone) throw new PublicOrderError("Bairro de entrega invalido");
    deliveryFeeCents = zone.feeCents;
  }

  const input: CreateOrderInput = {
    // Retirada usa o canal PDV (balcao); o flag pickup fica no endereco.
    channel: parsed.pickup ? "PDV" : "DELIVERY",
    customerId: parsed.customerId,
    customerName: parsed.customerName,
    deliveryAddress: parsed.pickup ? { pickup: true, notes: parsed.notes } : { ...parsed.address, notes: parsed.notes },
    items: parsed.items,
    couponCode: parsed.couponCode,
    paymentMethod: parsed.paymentMethod,
    deliveryFeeCents,
  };
  return createOrder(store.id, input);
}
