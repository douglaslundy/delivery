import type { Product, ProductAddon } from "@prisma/client";

export class PricingError extends Error {
  reason: string;

  constructor(reason: string) {
    super(reason);
    this.reason = reason;
  }
}

export type LineItemSelection = {
  productId: string;
  quantity: number;
  weightGrams?: number;
  selectedAddonIds: string[];
};

export function calculateItemPrice(
  product: Product,
  addons: ProductAddon[],
  selection: LineItemSelection,
): number {
  if (!product.active) {
    throw new PricingError("product is inactive");
  }

  if (selection.quantity <= 0) {
    throw new PricingError("quantity must be positive");
  }

  let total: number;
  if (product.pricePerKg) {
    if (selection.weightGrams == null || selection.weightGrams <= 0) {
      throw new PricingError("weightGrams must be a positive value for a per-kg product");
    }
    total = Math.round((product.priceCents ?? 0) * selection.weightGrams / 1000);
  } else {
    total = (product.priceCents ?? 0) * selection.quantity;
  }

  const groups = addons.reduce<Record<string, ProductAddon[]>>((acc, addon) => {
    (acc[addon.groupName] ??= []).push(addon);
    return acc;
  }, {});

  for (const [groupName, groupAddons] of Object.entries(groups)) {
    const selectedActiveInGroup = groupAddons.filter((a) => a.active && selection.selectedAddonIds.includes(a.id));

    if (groupAddons.some((a) => a.required) && selectedActiveInGroup.length === 0) {
      throw new PricingError(`addon group "${groupName}" requires a selection`);
    }

    if (groupAddons.some((a) => !a.multiple) && selectedActiveInGroup.length > 1) {
      throw new PricingError(`addon group "${groupName}" allows only one selection`);
    }
  }

  const selectedAddons = addons.filter((a) => selection.selectedAddonIds.includes(a.id) && a.active);
  total += selectedAddons.reduce((sum, a) => sum + a.priceCents, 0) * selection.quantity;

  return total;
}
