type OrderForPrint = {
  id: string;
  channel: "PDV" | "SALAO" | "DELIVERY" | "AGENDADO";
  tableNumber: string | null;
  totalCents: number;
  status: string;
};

type OrderItemForPrint = {
  productId: string;
  // OrderItem only stores productId; the caller must resolve the product's
  // name (e.g. join against Product) before calling this function.
  productName: string;
  quantity: number;
  unitPriceCents: number;
  addons: { id: string; name: string; priceCents: number }[];
};

export type PrintPayload = {
  templateId: "comanda" | "recibo";
  data: {
    orderId: string;
    channel: string;
    tableNumber: string | null;
    items: { name: string; quantity: number; unitPriceCents: number; addons: string[] }[];
    totalCents: number;
  };
};

// Builder call, unverified against a real Evolution/print agent (spec 05 explicit
// pendency) — if the client's print agent expects a different shape, adapt this
// function's output instead of keeping this contract.
export function buildPrintPayload(order: OrderForPrint, items: OrderItemForPrint[]): PrintPayload {
  const templateId = order.status === "COMPLETED" ? "recibo" : "comanda";

  return {
    templateId,
    data: {
      orderId: order.id,
      channel: order.channel,
      tableNumber: order.tableNumber,
      items: items.map((item) => ({
        name: item.productName,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        addons: item.addons.map((a) => a.name),
      })),
      totalCents: order.totalCents,
    },
  };
}
