# Delivery Platform — Menu (Cardápio) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the cardápio domain — categories, products (fixed price or per-kg), classification tags, and addon groups — with tenant-scoped CRUD APIs and the price-calculation helper the Orders plan depends on.

**Architecture:** Prisma models appended to the existing `prisma/schema.prisma` (Foundation plan), Next route handlers under `src/app/api/stores/[storeId]/...` guarded by the Foundation middleware/session, and a pure `calculateItemPrice` function that later becomes the single source of truth Orders uses to price every line item server-side.

**Tech Stack:** Next 16 route handlers, Prisma 6, Vitest. No new UI dependency: menu management pages use plain React Server Components + CSS, no component library added (none was decided in brainstorming; adding one now would be an unrequested dependency).

**Spec:** `docs/superpowers/specs/2026-10-21-delivery-design-01-domain-model.md` (section "Cardápio") — executors read it alongside this plan.

**Depends on:** `docs/superpowers/plans/2026-10-21-delivery-00-foundation.md` (Prisma client, `storeId` session, tenant middleware). All routes here assume `session.storeId` is already resolved and enforced.

## Global Constraints

- Every model carries `storeId`; FKs between menu tables use the `(storeId, id)` composite pattern already fixed in Foundation Task 2 (spec 01).
- No route accepts a client-supplied price; prices are read from the stored `Product`/`ProductAddon` rows only (spec 02 price-recalculation rule, which this plan's `calculateItemPrice` exists to serve).
- No `Variant` model — `ProductAddon` is the only extras mechanism (spec 01, explicit builder note).
- A `Product` is either fixed-price (`priceCents` set, `pricePerKg = false`) or sold by weight (`pricePerKg = true`, `priceCents` is the price per kg) — never both ambiguous at once; this plan enforces that at the API validation layer since the spec leaves the exact constraint to the builder.

## Review Focus

- **Per-kg product without a weight at order time:** a `pricePerKg` product's price cannot be computed without `weightGrams` — test: `calculateItemPrice` throws/returns an error for a per-kg product when `weightGrams` is missing, rather than silently pricing it as zero or as a fixed item.
- **Inactive product/addon still purchasable:** `active: false` products or addons must be excluded from price calculation and from the public menu listing — test: `calculateItemPrice` rejects an inactive product id; the list endpoint excludes inactive rows by default.
- **Cross-tenant category/product access:** a request for store A must never read or mutate store B's category/product/addon, even with a guessed valid id — test: fetching/updating a product by id under the wrong `storeId` returns 404, not the other store's data.
- **Required addon group not satisfied:** `calculateItemPrice` must reject an order line that omits a selection from a `required: true` addon group — test: pricing a line item missing a required group's choice fails with a clear error, not a price that silently ignores the requirement.
- **Multiple selections on a single-choice addon group:** a `multiple: false` group must reject more than one selected addon from that group — test: pricing a line item with two addons from the same `multiple: false` group fails.

---

## File Structure

- `prisma/schema.prisma` — append `Category`, `Product`, `ProductClassification`, `ProductAddon` (spec 01 verbatim).
- `src/lib/menu/pricing.ts` — `calculateItemPrice`.
- `src/app/api/stores/[storeId]/categories/route.ts`, `.../categories/[categoryId]/route.ts`
- `src/app/api/stores/[storeId]/products/route.ts`, `.../products/[productId]/route.ts`
- `src/app/api/stores/[storeId]/products/[productId]/addons/route.ts`, `.../addons/[addonId]/route.ts`
- `src/app/api/stores/[storeId]/products/[productId]/classifications/route.ts`
- `src/app/(dashboard)/[store]/menu/page.tsx`, `.../menu/[productId]/page.tsx` — minimal admin UI.
- Tests mirror each file under `tests/menu/...`.

## Task 1: Menu schema + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Test: `tests/menu/schema.test.ts`

**Interfaces:**
- Consumes: `Store` (Foundation Task 2).
- Produces: `Category`, `Product`, `ProductClassification`, `ProductAddon` models exactly as specified in spec 01 (fields, `@@unique([storeId, id])`, indexes) — every later task in this plan reads/writes these models.

- [ ] **Step 1: Append the four models to `prisma/schema.prisma`**

Copy the `Category`, `Product`, `ProductClassification`, `ProductAddon` blocks verbatim from spec 01 "Cardápio" section.

- [ ] **Step 2: Generate and run the migration**

Run: `npx prisma migrate dev --name menu_schema`
Expected: exits 0, migration applied to the dev database from Foundation Task 1.

- [ ] **Step 3: Write the schema smoke test**

```ts
import { prisma } from "@/lib/prisma";
import { describe, it, expect, afterAll } from "vitest";

describe("menu schema", () => {
  it("creates a category and a fixed-price product under it", async () => {
    const store = await prisma.store.create({ data: { slug: "menu-schema-teste", name: "Teste" } });
    const category = await prisma.category.create({ data: { storeId: store.id, name: "Pizzas" } });
    const product = await prisma.product.create({
      data: { storeId: store.id, categoryId: category.id, name: "Margherita", priceCents: 4500 },
    });
    expect(product.pricePerKg).toBe(false);
    await prisma.store.delete({ where: { id: store.id } }); // cascades
  });
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/menu/schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations tests/menu/schema.test.ts
git commit -m "feat: add menu schema (Category/Product/ProductClassification/ProductAddon)"
```

## Task 2: Category CRUD API

**Files:**
- Create: `src/app/api/stores/[storeId]/categories/route.ts` (GET list, POST create)
- Create: `src/app/api/stores/[storeId]/categories/[categoryId]/route.ts` (PATCH update, DELETE)
- Test: `tests/menu/categories.test.ts`

**Interfaces:**
- Consumes: `prisma` (Foundation Task 3), tenant guard (Foundation Task 7 — `storeId` in the URL must equal `session.storeId`, enforced by middleware already; these handlers additionally scope every query by `storeId` as defense in depth).
- Produces: `GET /api/stores/:storeId/categories` → `Category[]` ordered by `position`; `POST` → created `Category`; `PATCH`/`DELETE /:categoryId` scoped to `storeId`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "@/app/api/stores/[storeId]/categories/route";

describe("categories API", () => {
  let storeA: string, storeB: string;
  beforeEach(async () => {
    storeA = (await prisma.store.create({ data: { slug: "cat-a", name: "A" } })).id;
    storeB = (await prisma.store.create({ data: { slug: "cat-b", name: "B" } })).id;
  });
  afterEach(async () => {
    await prisma.store.deleteMany({ where: { id: { in: [storeA, storeB] } } });
  });

  it("creates a category scoped to the store", async () => {
    const res = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ name: "Bebidas" }) }), { params: { storeId: storeA } } as any);
    expect(res.status).toBe(201);
  });

  it("never returns another store's categories", async () => {
    await prisma.category.create({ data: { storeId: storeB, name: "So da B" } });
    const res = await GET(new Request("http://x"), { params: { storeId: storeA } } as any);
    const body = await res.json();
    expect(body).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/menu/categories.test.ts`
Expected: FAIL (route modules don't exist).

- [ ] **Step 3: Implement the two route files**

`GET`: `prisma.category.findMany({ where: { storeId }, orderBy: { position: "asc" } })`. `POST`: validate `name` is a non-empty string, create with `storeId` from the route param, return 201 with the created row. `PATCH`/`DELETE`: `where: { storeId_id: { storeId, id: categoryId } }` (composite unique from Task 1) so a mismatched `storeId` yields Prisma's not-found error → map to 404.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/menu/categories.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/stores/[storeId]/categories tests/menu/categories.test.ts
git commit -m "feat: add category CRUD API"
```

## Task 3: Product CRUD API with fixed/per-kg validation

**Files:**
- Create: `src/app/api/stores/[storeId]/products/route.ts`
- Create: `src/app/api/stores/[storeId]/products/[productId]/route.ts`
- Test: `tests/menu/products.test.ts`

**Interfaces:**
- Consumes: `Category` (Task 2, for `categoryId` validation), `prisma`.
- Produces: `POST /api/stores/:storeId/products` body `{ name, categoryId?, priceCents?, pricePerKg?, description? }`; rejects with 400 when both `priceCents` is unset and `pricePerKg` is false (no price at all), or when `pricePerKg` is true and `priceCents` (the per-kg rate) is unset. Later tasks (Task 5 pricing, Orders plan) rely on every stored `Product` satisfying exactly one pricing mode.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/stores/[storeId]/products/route";

describe("products API", () => {
  let storeId: string;
  beforeEach(async () => { storeId = (await prisma.store.create({ data: { slug: "prod-teste", name: "T" } })).id; });
  afterEach(async () => { await prisma.store.delete({ where: { id: storeId } }); });

  it("creates a fixed-price product", async () => {
    const res = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ name: "Suco", priceCents: 800 }) }), { params: { storeId } } as any);
    expect(res.status).toBe(201);
  });

  it("creates a per-kg product", async () => {
    const res = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ name: "Feijoada self-service", pricePerKg: true, priceCents: 6900 }) }), { params: { storeId } } as any);
    expect(res.status).toBe(201);
  });

  it("rejects a product with no price at all", async () => {
    const res = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ name: "Sem preco" }) }), { params: { storeId } } as any);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/menu/products.test.ts`
Expected: FAIL (route module doesn't exist).

- [ ] **Step 3: Implement the two route files**

`POST`/`PATCH`: validate `priceCents` is a positive integer in all cases (it is always "the price" — fixed total or per-kg rate depending on `pricePerKg`); 400 with a clear message when missing. `GET` list supports `?active=true` filter (default: all, including inactive, for the admin UI; Task 6's public listing filters client-side-equivalent by always passing `?active=true`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/menu/products.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/stores/[storeId]/products tests/menu/products.test.ts
git commit -m "feat: add product CRUD API with pricing-mode validation"
```

## Task 4: Addon groups CRUD API

**Files:**
- Create: `src/app/api/stores/[storeId]/products/[productId]/addons/route.ts`
- Create: `src/app/api/stores/[storeId]/products/[productId]/addons/[addonId]/route.ts`
- Test: `tests/menu/addons.test.ts`

**Interfaces:**
- Consumes: `Product` (Task 3).
- Produces: `POST .../addons` body `{ groupName, name, priceCents, required, multiple }`; `GET` lists addons for a product grouped by `groupName` as `Record<string, ProductAddon[]>` — Task 5's pricing helper consumes this same grouping shape.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST, GET } from "@/app/api/stores/[storeId]/products/[productId]/addons/route";

describe("addons API", () => {
  let storeId: string, productId: string;
  beforeEach(async () => {
    storeId = (await prisma.store.create({ data: { slug: "addon-teste", name: "T" } })).id;
    productId = (await prisma.product.create({ data: { storeId, name: "Pizza", priceCents: 4000 } })).id;
  });
  afterEach(async () => { await prisma.store.delete({ where: { id: storeId } }); });

  it("creates a required single-choice addon group entry", async () => {
    const res = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ groupName: "Tamanho", name: "Grande", priceCents: 500, required: true, multiple: false }) }), { params: { storeId, productId } } as any);
    expect(res.status).toBe(201);
  });

  it("groups addons by groupName on GET", async () => {
    await prisma.productAddon.create({ data: { storeId, productId, groupName: "Borda", name: "Catupiry", priceCents: 600 } });
    const res = await GET(new Request("http://x"), { params: { storeId, productId } } as any);
    const body = await res.json();
    expect(Object.keys(body)).toContain("Borda");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/menu/addons.test.ts`
Expected: FAIL (route module doesn't exist).

- [ ] **Step 3: Implement the two route files**

`GET`: fetch all `ProductAddon` for `(storeId, productId)`, reduce into `Record<groupName, ProductAddon[]>`. `POST`/`PATCH`/`DELETE`: scope by `(storeId, productId, id)`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/menu/addons.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/stores/[storeId]/products/[productId]/addons tests/menu/addons.test.ts
git commit -m "feat: add addon group CRUD API"
```

## Task 5: `calculateItemPrice` (consumed by the Orders plan)

**Files:**
- Create: `src/lib/menu/pricing.ts`
- Test: `tests/menu/pricing.test.ts`

**Interfaces:**
- Consumes: a `Product` row, its `ProductAddon[]` (Task 4's shape), and a line-item selection `{ productId, quantity, weightGrams?, selectedAddonIds: string[] }`.
- Produces: `calculateItemPrice(product: Product, addons: ProductAddon[], selection: LineItemSelection): number` (cents) — throws `PricingError` (exported from the same file) with a descriptive `.reason` on any invalid input listed below. The Orders plan's order-creation handler is the consumer: it calls this once per line item and never trusts a client-sent price.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { calculateItemPrice, PricingError } from "@/lib/menu/pricing";

const fixedProduct = { id: "p1", priceCents: 4000, pricePerKg: false, active: true } as any;
const perKgProduct = { id: "p2", priceCents: 6000, pricePerKg: true, active: true } as any; // per kg
const requiredGroup = [{ id: "a1", productId: "p1", groupName: "Tamanho", priceCents: 500, required: true, multiple: false, active: true }] as any;

describe("calculateItemPrice", () => {
  it("prices a fixed product by quantity", () => {
    expect(calculateItemPrice(fixedProduct, [], { productId: "p1", quantity: 2, selectedAddonIds: [] })).toBe(8000);
  });

  it("prices a per-kg product by weight", () => {
    expect(calculateItemPrice(perKgProduct, [], { productId: "p2", quantity: 1, weightGrams: 500, selectedAddonIds: [] })).toBe(3000); // 500g of a 6000-cents/kg item
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
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/menu/pricing.test.ts`
Expected: FAIL ("calculateItemPrice is not a function").

- [ ] **Step 3: Implement `calculateItemPrice` and `PricingError` in `src/lib/menu/pricing.ts`**

Order of checks: (1) product `active`, throw if not; (2) pricing mode — `pricePerKg` requires `weightGrams`, compute `Math.round(priceCents * weightGrams / 1000)`; otherwise `priceCents * quantity`; (3) group addons by `groupName`, for each group with `required: true` ensure at least one selected addon belongs to it, for each group with `multiple: false` ensure at most one selected addon belongs to it; (4) sum selected (active) addon `priceCents` into the total.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/menu/pricing.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/menu/pricing.ts tests/menu/pricing.test.ts
git commit -m "feat: add server-side item pricing with addon validation"
```

## Task 6: Minimal admin UI — menu list + product form

**Files:**
- Create: `src/app/(dashboard)/[store]/menu/page.tsx` (category/product list, grouped, with active toggle)
- Create: `src/app/(dashboard)/[store]/menu/[productId]/page.tsx` (create/edit form: name, category, price fields that switch between fixed/per-kg, addon groups editor)
- Test: none required (no test framework decision made for UI components in this plan; manual verification per the project's "test in a browser before reporting done" rule)

**Interfaces:**
- Consumes: Tasks 2–4's route handlers (same-origin `fetch`).
- Produces: the only UI surface this plan adds; later plans (Orders) link to it but don't depend on its internals.

- [ ] **Step 1: Build the menu list page**

Server component: fetch categories + products for `session.storeId`, render grouped by category with an active/inactive toggle (calls Task 3's `PATCH`).

- [ ] **Step 2: Build the product form page**

Client component: fields for name, category select, a pricing-mode radio (fixed vs. per-kg) that shows the matching price input, and an addon-groups editor (add/remove groups and options) calling Tasks 3–4's routes.

- [ ] **Step 3: Manually verify in a browser**

Start dev server (`npm run dev`), create a category, a fixed-price product, a per-kg product, and an addon group through the UI; confirm each persists and round-trips the pricing-mode validation from Task 3 (attempt saving a product with no price and confirm the UI surfaces the 400).

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/[store]/menu
git commit -m "feat: add minimal menu management UI"
```

---

## Self-Review Notes

- **Spec coverage:** Categoria/produto/preço fixo-ou-kg/adicionais/disponibilidade — all of spec 01's "Cardápio" section — are covered by Tasks 1–6; nothing in that section is left unaddressed.
- **Step scan:** every code step gives an exact signature or validation rule; UI tasks (6) intentionally leave layout/styling to the implementer since no design system was chosen in brainstorming (ponytail: no unrequested dependency added).
- **Type consistency:** `calculateItemPrice`'s `LineItemSelection` shape (`productId, quantity, weightGrams?, selectedAddonIds`) is the exact shape the Orders plan's order-creation payload (spec 02 `items[]`) must map into — flagged here so the next plan's author keeps the names aligned.
- **Review Focus:** all 5 lines map to Task 5's tests (per-kg weight, inactive product, required group, single-choice group) and Task 2's tests (cross-tenant leak).
- **Proportion:** plan length tracks the spec section; Task 6 deliberately stays at interface/acceptance level since UI has no fixed design system yet.
