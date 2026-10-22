import { describe, it, expect } from "vitest";
import { calculateItemPrice, PricingError } from "@/lib/menu/pricing";

const fixedProduct = { id: "p1", priceCents: 4000, pricePerKg: false, active: true } as any;
const perKgProduct = { id: "p2", priceCents: 6000, pricePerKg: true, active: true } as any;
const requiredGroup = [{ id: "a1", productId: "p1", groupName: "Tamanho", priceCents: 500, required: true, multiple: false, active: true }] as any;

describe("calculateItemPrice", () => {
  it("prices a fixed product by quantity", () => {
    expect(calculateItemPrice(fixedProduct, [], { productId: "p1", quantity: 2, selectedAddonIds: [] })).toBe(8000);
  });

  it("prices a per-kg product by weight", () => {
    expect(calculateItemPrice(perKgProduct, [], { productId: "p2", quantity: 1, weightGrams: 500, selectedAddonIds: [] })).toBe(3000);
  });

  it("throws when a per-kg product has no weight", () => {
    expect(() => calculateItemPrice(perKgProduct, [], { productId: "p2", quantity: 1, selectedAddonIds: [] })).toThrow(PricingError);
  });

  it("throws when a required addon group has no selection", () => {
    expect(() => calculateItemPrice(fixedProduct, requiredGroup, { productId: "p1", quantity: 1, selectedAddonIds: [] })).toThrow(PricingError);
  });

  it("throws when an inactive product is priced", () => {
    expect(() => calculateItemPrice({ ...fixedProduct, active: false }, [], { productId: "p1", quantity: 1, selectedAddonIds: [] })).toThrow(PricingError);
  });

  it("throws when two addons from the same single-choice group are selected", () => {
    const group = [
      { id: "a1", productId: "p1", groupName: "Molho", priceCents: 0, required: false, multiple: false, active: true },
      { id: "a2", productId: "p1", groupName: "Molho", priceCents: 0, required: false, multiple: false, active: true },
    ] as any;
    expect(() => calculateItemPrice(fixedProduct, group, { productId: "p1", quantity: 1, selectedAddonIds: ["a1", "a2"] })).toThrow(PricingError);
  });

  it("multiplies addon price by quantity, same as the product itself", () => {
    const addon = [{ id: "a1", productId: "p1", groupName: "Borda", priceCents: 500, required: false, multiple: false, active: true }] as any;
    expect(calculateItemPrice(fixedProduct, addon, { productId: "p1", quantity: 2, selectedAddonIds: ["a1"] })).toBe(8000 + 1000);
  });

  it("does not let an inactive addon satisfy a required group", () => {
    const group = [{ id: "a1", productId: "p1", groupName: "Tamanho", priceCents: 0, required: true, multiple: false, active: false }] as any;
    expect(() => calculateItemPrice(fixedProduct, group, { productId: "p1", quantity: 1, selectedAddonIds: ["a1"] })).toThrow(PricingError);
  });

  it("throws when quantity is zero or negative", () => {
    expect(() => calculateItemPrice(fixedProduct, [], { productId: "p1", quantity: 0, selectedAddonIds: [] })).toThrow(PricingError);
    expect(() => calculateItemPrice(fixedProduct, [], { productId: "p1", quantity: -1, selectedAddonIds: [] })).toThrow(PricingError);
  });

  it("throws when weightGrams is zero or negative for a per-kg product", () => {
    expect(() => calculateItemPrice(perKgProduct, [], { productId: "p2", quantity: 1, weightGrams: 0, selectedAddonIds: [] })).toThrow(PricingError);
    expect(() => calculateItemPrice(perKgProduct, [], { productId: "p2", quantity: 1, weightGrams: -100, selectedAddonIds: [] })).toThrow(PricingError);
  });
});
