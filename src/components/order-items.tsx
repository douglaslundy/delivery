export type OrderLine = {
  quantity: number;
  productName?: string;
  weightGrams?: number | null;
  addons?: unknown;
};

export default function OrderItems({ items }: { items?: OrderLine[] }) {
  if (!items || items.length === 0) return null;
  return (
    <ul className="t-items">
      {items.map((item, i) => {
        const addons = Array.isArray(item.addons) ? (item.addons as { name: string }[]) : [];
        return (
          <li key={i}>
            <strong>{item.weightGrams ? `${item.weightGrams} g` : `${item.quantity}x`}</strong> {item.productName ?? "Item"}
            {addons.length > 0 && <span className="hint"> + {addons.map((a) => a.name).join(", ")}</span>}
          </li>
        );
      })}
    </ul>
  );
}
