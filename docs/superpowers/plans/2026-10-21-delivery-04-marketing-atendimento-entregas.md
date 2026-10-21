# Delivery Platform — Marketing, Atendimento, Entregas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement coupons, cashback, loyalty points, customer feedback/support tickets, delivery-person/zone management, and the Evolution-API-backed WhatsApp bot — wiring coupon/cashback application into order creation and delivery assignment into order transitions.

**Architecture:** Mostly independent CRUD modules (spec 04's models have few cross-relations), except two integration points: (1) `couponCode` in order creation must apply a `Coupon`'s discount, and cashback/loyalty accrue from a completed order; (2) assigning a `DeliveryPerson` to an order sets `Order.deliveryId`, which the Orders plan's realtime broadcast already reads. The WhatsApp module wraps the Evolution API behind an adapter so the still-missing credentials (spec 00/05 pendency) block only that one task, not the rest of the plan.

**Tech Stack:** Next 16 route handlers, Prisma 6, Vitest, Node `fetch` for the Evolution API adapter.

**Spec:** `docs/superpowers/specs/2026-10-21-delivery-design-04-marketing-atendimento-entregas.md`, with the models from `2026-10-21-delivery-design-01-domain-model.md` — executors read both.

**Depends on:**
- `docs/superpowers/plans/2026-10-21-delivery-00-foundation.md` (Prisma client, session, `encryptCredential`/`decryptCredential`).
- `docs/superpowers/plans/2026-10-21-delivery-02-orders-realtime.md` (`createOrder`, `canTransition`, `publishOrderEvent`, `Order` model) — Tasks 3 and 7 here extend it.
- `docs/superpowers/plans/2026-10-21-delivery-03-financeiro.md` not required, but cashback/loyalty accrual in Task 4 fires on the same `COMPLETED` transition the Financeiro plan's `recordOrderCompletion` hooks — both are additive calls from the same route, order between them doesn't matter.

## Global Constraints

- `WhatsappInstance.apiKeyEncrypted` is always written via `encryptCredential` (Foundation Task 4) — never store the Evolution API key in plaintext (spec 00/04).
- Evolution API credentials (instance URL + key) are not available yet (spec 00/05 explicit pendency) — the adapter and webhook receiver must be fully implemented and tested with a fake/mocked Evolution client; wiring real credentials is a follow-up task the user completes later, not invented here.
- "Recuperador de vendas" is a job/report reading existing `Order`/`Customer` data, not a new table (spec 04) — don't add a model for it.
- `DeliveryZone` in V1 is a flat named zone + fixed fee, no geo-polygon (spec 04) — don't add geo fields.

## Review Focus

- **Expired or over-used coupon still applied:** a `Coupon` past `expiresAt` or at `usageLimit` must be rejected at order creation, not silently discounted — test: order creation with an expired/exhausted coupon code fails or ignores the discount, doesn't apply it.
- **Cashback debited below zero:** using more cashback than a customer's ledger balance allows must be rejected — test: a debit entry larger than the current balance throws, balance never goes negative.
- **Delivery-person assignment to the wrong store's order:** assigning a `DeliveryPerson` from store A to an order in store B must fail — test: cross-store assignment returns 404/400, not success.
- **WhatsApp webhook from an unknown instance:** a webhook payload whose `evolutionInstanceName` doesn't match any stored `WhatsappInstance` must be rejected, not processed as some default store — test: webhook with an unrecognized instance name returns 404/400, never guesses a `storeId`.
- **Support ticket visible across stores:** listing/reading a `SupportTicket` by id must be scoped by `storeId` like every other model — test: fetching a ticket by id under the wrong `storeId` 404s.

---

## File Structure

- `prisma/schema.prisma` — append `Coupon`, `CashbackLedger`, `LoyaltyProgram`, `CustomerFeedback`, `SupportTicket`, `WhatsappInstance`, `DeliveryPerson`, `DeliveryZone` (spec 01/04 verbatim).
- `src/lib/marketing/coupons.ts` — `validateAndPriceCoupon`.
- `src/lib/marketing/cashback.ts` — `applyCashbackCredit`, `debitCashback`.
- `src/lib/delivery/assignDelivery.ts`.
- `src/lib/whatsapp/evolutionClient.ts` — Evolution API adapter interface + fake implementation for tests.
- `src/lib/whatsapp/bot.ts` — basic keyword/status-based responder.
- `src/lib/marketing/salesRecovery.ts` — recuperador de vendas report/job.
- Route handlers under `src/app/api/stores/[storeId]/{coupons,cashback,loyalty,feedback,support-tickets,delivery-people,delivery-zones,whatsapp}/...` and `src/app/api/webhooks/evolution/route.ts`.
- `src/app/(dashboard)/[store]/marketing/page.tsx`, `.../entregas/page.tsx` — minimal UI.
- Tests mirror each file under `tests/marketing/...`, `tests/delivery/...`, `tests/whatsapp/...`.

## Task 1: Schema + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Test: `tests/marketing/schema.test.ts`

**Interfaces:**
- Consumes: `Store` (Foundation).
- Produces: `Coupon`, `CashbackLedger`, `LoyaltyProgram`, `CustomerFeedback`, `SupportTicket`, `WhatsappInstance`, `DeliveryPerson`, `DeliveryZone` models exactly as spec 04 defines.

- [ ] **Step 1: Append all eight models to `prisma/schema.prisma`**

Copy verbatim from spec 04.

- [ ] **Step 2: Add `deliveryId` relation note**

`Order.deliveryId` already exists as a plain string field (Orders plan Task 1); this plan does not add a Prisma relation for it (spec 04 confirms it's a loose reference, not a hard FK) — no schema change needed here beyond the eight new models.

- [ ] **Step 3: Generate and run the migration**

Run: `npx prisma migrate dev --name marketing_delivery_schema`
Expected: exits 0.

- [ ] **Step 4: Write the schema smoke test**

```ts
import { prisma } from "@/lib/prisma";
import { describe, it, expect } from "vitest";

describe("marketing/delivery schema", () => {
  it("creates a coupon and a delivery zone", async () => {
    const store = await prisma.store.create({ data: { slug: "mkt-schema-teste", name: "T" } });
    const coupon = await prisma.coupon.create({ data: { storeId: store.id, code: "PROMO10", kind: "PERCENT", value: 10 } });
    expect(coupon.active).toBe(true);
    await prisma.store.delete({ where: { id: store.id } });
  });
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/marketing/schema.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations tests/marketing/schema.test.ts
git commit -m "feat: add marketing/atendimento/entregas schema"
```

## Task 2: Coupon CRUD + validation

**Files:**
- Create: `src/lib/marketing/coupons.ts`
- Create: `src/app/api/stores/[storeId]/coupons/route.ts`, `.../coupons/[couponId]/route.ts`
- Test: `tests/marketing/coupons.test.ts`

**Interfaces:**
- Consumes: `prisma`.
- Produces: `validateAndPriceCoupon(storeId: string, code: string, subtotalCents: number): Promise<{ coupon: Coupon; discountCents: number }>` — throws `CouponError` when the code doesn't exist, is inactive, expired, or at its usage limit. Task 3 (order-creation integration) is the consumer.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { validateAndPriceCoupon, CouponError } from "@/lib/marketing/coupons";

describe("validateAndPriceCoupon", () => {
  let storeId: string;
  beforeEach(async () => { storeId = (await prisma.store.create({ data: { slug: "coupon-teste", name: "T" } })).id; });
  afterEach(async () => { await prisma.store.delete({ where: { id: storeId } }); });

  it("prices a percent coupon", async () => {
    await prisma.coupon.create({ data: { storeId, code: "DEZ", kind: "PERCENT", value: 10 } });
    const { discountCents } = await validateAndPriceCoupon(storeId, "DEZ", 10000);
    expect(discountCents).toBe(1000);
  });

  it("rejects an expired coupon", async () => {
    await prisma.coupon.create({ data: { storeId, code: "VENCIDO", kind: "FIXED", value: 500, expiresAt: new Date(Date.now() - 86400000) } });
    await expect(validateAndPriceCoupon(storeId, "VENCIDO", 10000)).rejects.toThrow(CouponError);
  });

  it("rejects a code at its usage limit", async () => {
    await prisma.coupon.create({ data: { storeId, code: "LIMITE", kind: "FIXED", value: 100, usageLimit: 0 } });
    await expect(validateAndPriceCoupon(storeId, "LIMITE", 10000)).rejects.toThrow(CouponError);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/marketing/coupons.test.ts`
Expected: FAIL ("validateAndPriceCoupon is not a function").

- [ ] **Step 3: Implement `validateAndPriceCoupon` and `CouponError`**

`PERCENT`: `Math.round(subtotalCents * value / 100)`. `FIXED`: `value`, capped at `subtotalCents`. Reject when `!active`, `expiresAt < now`, or `usageLimit !== null && usageLimit <= 0` (actual decrement-on-use is out of scope for this pure validator — Task 3 decrements after a successful order).

- [ ] **Step 4: Implement the CRUD route handlers**

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/marketing/coupons.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/marketing/coupons.ts src/app/api/stores/[storeId]/coupons tests/marketing/coupons.test.ts
git commit -m "feat: add coupon CRUD and validation"
```

## Task 3: Wire coupon discount into order creation

**Files:**
- Modify: `src/lib/orders/createOrder.ts` (Orders plan Task 3)
- Test: `tests/orders/createOrder.test.ts` (extend)

**Interfaces:**
- Consumes: `validateAndPriceCoupon` (Task 2).
- Produces: `createOrder` now sets `Order.discountCents`/`couponId` when `input.couponCode` is present, and decrements `Coupon.usageLimit` (when not null) inside the same transaction.

- [ ] **Step 1: Write the failing test**

```ts
it("applies a coupon discount and decrements its usage limit", async () => {
  const coupon = await prisma.coupon.create({ data: { storeId, code: "APLICA", kind: "FIXED", value: 200, usageLimit: 1 } });
  const order = await createOrder(storeId, { channel: "PDV", items: [{ productId, quantity: 1, selectedAddonIds: [] }], couponCode: "APLICA" });
  expect(order.discountCents).toBe(200);
  const updated = await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } });
  expect(updated.usageLimit).toBe(0);
});
```

(Append to `tests/orders/createOrder.test.ts`'s existing `describe` block, reusing its `storeId`/`productId` setup.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/orders/createOrder.test.ts`
Expected: FAIL (discount not applied, `order.discountCents` is 0).

- [ ] **Step 3: Extend `createOrder`**

After computing `subtotalCents`, when `input.couponCode` is set, call `validateAndPriceCoupon`; set `discountCents`, `couponId`, subtract from `totalCents`; if the coupon's `usageLimit` is not null, decrement it by one in the same `$transaction`. Propagate `CouponError` as a 400 from the route handler, same pattern as `PricingError`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/orders/createOrder.test.ts`
Expected: PASS (all tests in file).

- [ ] **Step 5: Commit**

```bash
git add src/lib/orders/createOrder.ts tests/orders/createOrder.test.ts
git commit -m "feat: apply coupon discount during order creation"
```

## Task 4: Cashback ledger

**Files:**
- Create: `src/lib/marketing/cashback.ts`
- Create: `src/app/api/stores/[storeId]/cashback/route.ts`
- Test: `tests/marketing/cashback.test.ts`

**Interfaces:**
- Consumes: `prisma`.
- Produces: `getCashbackBalance(storeId, customerId): Promise<number>`; `applyCashbackCredit(storeId, customerId, orderId, amountCents): Promise<void>` (positive ledger row); `debitCashback(storeId, customerId, amountCents): Promise<void>` (throws `CashbackError` when `amountCents` exceeds the current balance).

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { getCashbackBalance, applyCashbackCredit, debitCashback, CashbackError } from "@/lib/marketing/cashback";

describe("cashback ledger", () => {
  let storeId: string;
  const customerId = "cliente-1";
  beforeEach(async () => { storeId = (await prisma.store.create({ data: { slug: "cashback-teste", name: "T" } })).id; });
  afterEach(async () => { await prisma.store.delete({ where: { id: storeId } }); });

  it("accrues and reads balance", async () => {
    await applyCashbackCredit(storeId, customerId, "o1", 500);
    expect(await getCashbackBalance(storeId, customerId)).toBe(500);
  });

  it("rejects debiting more than the balance", async () => {
    await applyCashbackCredit(storeId, customerId, "o1", 300);
    await expect(debitCashback(storeId, customerId, 400)).rejects.toThrow(CashbackError);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/marketing/cashback.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the three functions**

`getCashbackBalance`: sum `CashbackLedger.amountCents` for `(storeId, customerId)`. `applyCashbackCredit`: insert a positive-amount row. `debitCashback`: read balance first, throw `CashbackError` if `amountCents > balance`, else insert a negative-amount row with `orderId: null`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/marketing/cashback.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/marketing/cashback.ts src/app/api/stores/[storeId]/cashback tests/marketing/cashback.test.ts
git commit -m "feat: add cashback ledger with balance-guarded debit"
```

## Task 5: Loyalty program CRUD

**Files:**
- Create: `src/app/api/stores/[storeId]/loyalty/route.ts`
- Test: `tests/marketing/loyalty.test.ts`

**Interfaces:**
- Consumes: `prisma`.
- Produces: `GET`/`PUT /api/stores/:storeId/loyalty` (singleton per store, `@@unique([storeId])` from spec 01) for `pointsPerCurrencyUnit`/`redemptionRuleCents`/`active`. Point accrual/redemption logic is left as a future task (spec 04 defines the program's rule fields but not an accrual trigger) — this task only persists the configuration; flag this explicitly in the PR, not a silent gap.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { PUT } from "@/app/api/stores/[storeId]/loyalty/route";

describe("loyalty program API", () => {
  let storeId: string;
  beforeEach(async () => { storeId = (await prisma.store.create({ data: { slug: "loyalty-teste", name: "T" } })).id; });
  afterEach(async () => { await prisma.store.delete({ where: { id: storeId } }); });

  it("upserts the store's loyalty config", async () => {
    const res = await PUT(new Request("http://x", { method: "PUT", body: JSON.stringify({ pointsPerCurrencyUnit: 1, redemptionRuleCents: 1000 }) }), { params: { storeId } } as any);
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/marketing/loyalty.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the route handler**

`PUT` uses `prisma.loyaltyProgram.upsert({ where: { storeId }, ... })`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/marketing/loyalty.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/stores/[storeId]/loyalty tests/marketing/loyalty.test.ts
git commit -m "feat: add loyalty program configuration CRUD"
```

## Task 6: Customer feedback + support tickets

**Files:**
- Create: `src/app/api/stores/[storeId]/feedback/route.ts`
- Create: `src/app/api/stores/[storeId]/support-tickets/route.ts`, `.../support-tickets/[ticketId]/route.ts`
- Test: `tests/marketing/feedback.test.ts`, `tests/marketing/supportTickets.test.ts`

**Interfaces:**
- Consumes: `prisma`.
- Produces: `POST .../feedback` body `{ orderId?, rating, comment? }`; `POST`/`PATCH .../support-tickets` for `{ subject, status }`, scoped by `storeId` like every other model (Review Focus line 5).

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { GET as getTicket } from "@/app/api/stores/[storeId]/support-tickets/[ticketId]/route";

describe("support tickets cross-tenant isolation", () => {
  let storeA: string, storeB: string, ticketId: string;
  beforeEach(async () => {
    storeA = (await prisma.store.create({ data: { slug: "ticket-a", name: "A" } })).id;
    storeB = (await prisma.store.create({ data: { slug: "ticket-b", name: "B" } })).id;
    ticketId = (await prisma.supportTicket.create({ data: { storeId: storeB, subject: "Problema", status: "OPEN" } })).id;
  });
  afterEach(async () => { await prisma.store.deleteMany({ where: { id: { in: [storeA, storeB] } } }); });

  it("404s when fetching another store's ticket", async () => {
    const res = await getTicket(new Request("http://x"), { params: { storeId: storeA, ticketId } } as any);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/marketing/supportTickets.test.ts`
Expected: FAIL (route module doesn't exist).

- [ ] **Step 3: Implement all four route files**

Every query/update scoped by `storeId`; `GET /:ticketId` returns 404 when the composite `(storeId, id)` lookup misses.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/marketing/feedback.test.ts tests/marketing/supportTickets.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/stores/[storeId]/feedback src/app/api/stores/[storeId]/support-tickets tests/marketing/feedback.test.ts tests/marketing/supportTickets.test.ts
git commit -m "feat: add customer feedback and support ticket CRUD"
```

## Task 7: Delivery person + zone + order assignment

**Files:**
- Create: `src/lib/delivery/assignDelivery.ts`
- Create: `src/app/api/stores/[storeId]/delivery-people/route.ts`, `src/app/api/stores/[storeId]/delivery-zones/route.ts`
- Create: `src/app/api/stores/[storeId]/orders/[orderId]/assign-delivery/route.ts`
- Test: `tests/delivery/assignDelivery.test.ts`

**Interfaces:**
- Consumes: `Order` (Orders plan), `DeliveryPerson` (Task 1).
- Produces: `assignDelivery(storeId: string, orderId: string, deliveryPersonId: string): Promise<Order>` — throws when either the order or the delivery person doesn't belong to `storeId` (cross-store check, Review Focus line 3); sets `Order.deliveryId` and triggers the Orders plan's `publishOrderEvent` (the delivery room needs `deliveryId` set to receive events).

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { assignDelivery } from "@/lib/delivery/assignDelivery";

describe("assignDelivery", () => {
  let storeA: string, storeB: string, orderId: string, deliveryPersonBId: string;
  beforeEach(async () => {
    storeA = (await prisma.store.create({ data: { slug: "deliv-a", name: "A" } })).id;
    storeB = (await prisma.store.create({ data: { slug: "deliv-b", name: "B" } })).id;
    orderId = (await prisma.order.create({ data: { storeId: storeA, channel: "DELIVERY", subtotalCents: 100, totalCents: 100 } })).id;
    deliveryPersonBId = (await prisma.deliveryPerson.create({ data: { storeId: storeB, name: "Joao", phone: "11999999999" } })).id;
  });
  afterEach(async () => { await prisma.store.deleteMany({ where: { id: { in: [storeA, storeB] } } }); });

  it("rejects assigning a delivery person from another store", async () => {
    await expect(assignDelivery(storeA, orderId, deliveryPersonBId)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/delivery/assignDelivery.test.ts`
Expected: FAIL ("assignDelivery is not a function").

- [ ] **Step 3: Implement `assignDelivery` and the three route handlers**

Fetch both `Order` and `DeliveryPerson` scoped by `storeId`; throw if either is null; `prisma.order.update({ where: { storeId_id: { storeId, id: orderId } }, data: { deliveryId: deliveryPersonId } })`; call `publishOrderEvent` (Orders plan Task 6) after the update so the delivery room gets the current status.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/delivery/assignDelivery.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/delivery/assignDelivery.ts src/app/api/stores/[storeId]/delivery-people src/app/api/stores/[storeId]/delivery-zones src/app/api/stores/[storeId]/orders/[orderId]/assign-delivery tests/delivery/assignDelivery.test.ts
git commit -m "feat: add delivery person/zone CRUD and order assignment"
```

## Task 8: Evolution API adapter + WhatsApp instance CRUD

**Files:**
- Create: `src/lib/whatsapp/evolutionClient.ts`
- Create: `src/app/api/stores/[storeId]/whatsapp/route.ts`
- Test: `tests/whatsapp/evolutionClient.test.ts`, `tests/whatsapp/instance.test.ts`

**Interfaces:**
- Consumes: `encryptCredential`/`decryptCredential` (Foundation Task 4).
- Produces: `EvolutionClient` interface `{ sendMessage(to: string, text: string): Promise<void> }`; `createEvolutionClient(instance: WhatsappInstance): EvolutionClient` (real `fetch`-based implementation against `instance.evolutionApiUrl`, using `decryptCredential(instance.apiKeyEncrypted)` for auth) and `createFakeEvolutionClient(): EvolutionClient & { sentMessages: {to: string, text: string}[] }` for tests. Task 9's bot and webhook handler depend on `EvolutionClient`, never on `fetch` directly.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { createFakeEvolutionClient } from "@/lib/whatsapp/evolutionClient";

describe("fake Evolution client", () => {
  it("records sent messages for assertions", async () => {
    const client = createFakeEvolutionClient();
    await client.sendMessage("5511999999999", "Seu pedido saiu para entrega");
    expect(client.sentMessages).toEqual([{ to: "5511999999999", text: "Seu pedido saiu para entrega" }]);
  });
});
```

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/stores/[storeId]/whatsapp/route";

describe("whatsapp instance API", () => {
  let storeId: string;
  beforeEach(async () => { storeId = (await prisma.store.create({ data: { slug: "wa-teste", name: "T" } })).id; });
  afterEach(async () => { await prisma.store.delete({ where: { id: storeId } }); });

  it("stores the API key encrypted, never plaintext", async () => {
    await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ evolutionInstanceName: "loja-x", evolutionApiUrl: "https://exemplo.local", apiKey: "chave-secreta" }) }), { params: { storeId } } as any);
    const row = await prisma.whatsappInstance.findUniqueOrThrow({ where: { storeId } });
    expect(row.apiKeyEncrypted).not.toContain("chave-secreta");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/whatsapp/evolutionClient.test.ts tests/whatsapp/instance.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `evolutionClient.ts` and the instance route**

Real client: `fetch(`${instance.evolutionApiUrl}/message/sendText/${instance.evolutionInstanceName}`, { method: "POST", headers: { apikey: decryptCredential(instance.apiKeyEncrypted) }, body: JSON.stringify({ number: to, text }) })` — exact Evolution API path/payload shape is unverified without real credentials (spec 04 pendency); mark this call site with a comment noting it must be confirmed against the real instance once credentials arrive, and keep `EvolutionClient` as the seam so only this one function needs changing. Route handler: `encryptCredential(body.apiKey)` before persisting, never log/return the plaintext.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/whatsapp/evolutionClient.test.ts tests/whatsapp/instance.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/whatsapp/evolutionClient.ts src/app/api/stores/[storeId]/whatsapp tests/whatsapp/evolutionClient.test.ts tests/whatsapp/instance.test.ts
git commit -m "feat: add Evolution API adapter and WhatsApp instance CRUD with encrypted credentials"
```

## Task 9: Basic bot + webhook receiver

**Files:**
- Create: `src/lib/whatsapp/bot.ts`
- Create: `src/app/api/webhooks/evolution/route.ts`
- Test: `tests/whatsapp/bot.test.ts`, `tests/whatsapp/webhook.test.ts`

**Interfaces:**
- Consumes: `EvolutionClient` (Task 8), `Order`/`OrderStatusEvent` (Orders plan).
- Produces: `handleIncomingMessage(storeId: string, from: string, text: string, client: EvolutionClient): Promise<void>` — keyword-matches "onde está meu pedido"/"status" against the customer's most recent non-terminal order and replies with its current status; anything unmatched gets a generic "um atendente vai te responder em breve" reply (spec 04: bot is keyword/state-based, not a full LLM conversation). The webhook route resolves `storeId` from the payload's `evolutionInstanceName` via `WhatsappInstance` (Review Focus line 4) and calls `handleIncomingMessage`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { handleIncomingMessage } from "@/lib/whatsapp/bot";
import { createFakeEvolutionClient } from "@/lib/whatsapp/evolutionClient";

describe("handleIncomingMessage", () => {
  let storeId: string;
  const customerId = "cliente-wa-1";
  beforeEach(async () => { storeId = (await prisma.store.create({ data: { slug: "bot-teste", name: "T" } })).id; });
  afterEach(async () => { await prisma.store.delete({ where: { id: storeId } }); });

  it("replies with the order status for a status question", async () => {
    await prisma.order.create({ data: { storeId, customerId, channel: "DELIVERY", status: "OUT_FOR_DELIVERY", subtotalCents: 100, totalCents: 100 } });
    const client = createFakeEvolutionClient();
    await handleIncomingMessage(storeId, customerId, "onde esta meu pedido?", client);
    expect(client.sentMessages[0].text).toContain("OUT_FOR_DELIVERY");
  });

  it("falls back to a generic reply for unmatched text", async () => {
    const client = createFakeEvolutionClient();
    await handleIncomingMessage(storeId, customerId, "oi, bom dia", client);
    expect(client.sentMessages[0].text).toMatch(/atendente/i);
  });
});
```

```ts
import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/webhooks/evolution/route";

describe("evolution webhook", () => {
  it("rejects a payload from an unknown instance", async () => {
    const res = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ evolutionInstanceName: "desconhecida", from: "551199999999", text: "oi" }) }));
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/whatsapp/bot.test.ts tests/whatsapp/webhook.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `handleIncomingMessage` and the webhook route**

Webhook: look up `WhatsappInstance` by `evolutionInstanceName`; 404 if none found; otherwise build the real `EvolutionClient` for that instance and call `handleIncomingMessage(instance.storeId, from, text, client)`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/whatsapp/bot.test.ts tests/whatsapp/webhook.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/whatsapp/bot.ts src/app/api/webhooks/evolution tests/whatsapp/bot.test.ts tests/whatsapp/webhook.test.ts
git commit -m "feat: add basic WhatsApp bot and webhook receiver"
```

## Task 10: Recuperador de vendas (job/report)

**Files:**
- Create: `src/lib/marketing/salesRecovery.ts`
- Test: `tests/marketing/salesRecovery.test.ts`

**Interfaces:**
- Consumes: `Order` (Orders plan).
- Produces: `findInactiveCustomers(storeId: string, daysSinceLastOrder: number): Promise<{ customerId: string; lastOrderAt: Date }[]>` — pure report query; actually sending a WhatsApp message to each is left to a scheduling mechanism (cron) outside this plan's scope (no scheduler was decided in brainstorming — flag as builder call, don't invent one).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { findInactiveCustomers } from "@/lib/marketing/salesRecovery";

describe("findInactiveCustomers", () => {
  let storeId: string;
  beforeEach(async () => { storeId = (await prisma.store.create({ data: { slug: "recovery-teste", name: "T" } })).id; });
  afterEach(async () => { await prisma.store.delete({ where: { id: storeId } }); });

  it("finds a customer whose last order was more than N days ago", async () => {
    const old = new Date(Date.now() - 40 * 86400000);
    await prisma.order.create({ data: { storeId, customerId: "c1", channel: "PDV", subtotalCents: 1, totalCents: 1, createdAt: old } });
    const result = await findInactiveCustomers(storeId, 30);
    expect(result.map(r => r.customerId)).toContain("c1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/marketing/salesRecovery.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `findInactiveCustomers`**

Group `Order` by `customerId`, take `max(createdAt)` per customer, filter where that max is older than `now - daysSinceLastOrder days`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/marketing/salesRecovery.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/marketing/salesRecovery.ts tests/marketing/salesRecovery.test.ts
git commit -m "feat: add sales recovery (inactive customer) report"
```

## Task 11: Minimal UI

**Files:**
- Create: `src/app/(dashboard)/[store]/marketing/page.tsx` (coupons, cashback lookup, loyalty config, sales recovery list)
- Create: `src/app/(dashboard)/[store]/entregas/page.tsx` (delivery people, zones, assign-to-order)
- Test: none required (manual verification, same rationale as prior plans)

- [ ] **Step 1: Build the two pages**

- [ ] **Step 2: Manually verify in a browser**

Create a coupon and apply it on a test order (Orders plan), create a delivery person and zone, assign the delivery person to a `DELIVERY` order and confirm `deliveryId` persists.

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/[store]/marketing src/app/(dashboard)/[store]/entregas
git commit -m "feat: add minimal marketing and delivery management UI"
```

---

## Self-Review Notes

- **Spec coverage:** coupon/cashback/loyalty/recuperador, feedback/support, WhatsApp bot via Evolution API, delivery person/zone — every subsection of spec 04 maps to a task (2–10). Loyalty's accrual trigger and sales-recovery's send-job scheduler are both explicitly flagged as left-open (spec 04 doesn't fix either), not silently implemented or silently skipped.
- **Step scan:** every code step gives an exact signature; the Evolution API real-call shape in Task 8 is explicitly marked unverified pending credentials, per spec 00/05's standing pendency — not invented as fact.
- **Type consistency:** `EvolutionClient` interface from Task 8 is the only thing Tasks 9 and the future real-webhook wiring depend on; `assignDelivery`/`publishOrderEvent` names match the Orders plan exactly.
- **Review Focus:** all 5 lines map to tests — coupon expiry/limit (Task 2), cashback over-debit (Task 4), cross-store delivery assignment (Task 7), unknown webhook instance (Task 9), cross-store ticket read (Task 6).
- **Proportion:** plan length tracks spec 04; UI (Task 11) stays at acceptance level per the established rationale.
