# Delivery Platform — Orders + Realtime/KDS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement order creation/transition with a single `OrderStatus` state machine, server-side price recalculation, append-only status history, and the tenant-scoped realtime channel (KDS, order tracking, delivery-person rooms) that broadcasts every transition.

**Architecture:** Order creation/transition are plain Next route handlers backed by a pure `canTransition` function and `calculateItemPrice` (Menu plan). Every accepted transition writes an `OrderStatusEvent` row and publishes a small event to a custom WebSocket server embedded alongside the Next app; clients reconcile via REST on reconnect.

**Tech Stack:** Next 16 route handlers, Prisma 6, a WebSocket library selected in Task 5 (builder call — spec 02 left `ws` vs `socket.io` and native-route-handler-upgrade vs. custom Node server open), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-21-delivery-design-02-order-flow-realtime.md`, with the `Order`/`OrderItem`/`OrderStatusEvent` models from `2026-10-21-delivery-design-01-domain-model.md` — executors read both.

**Depends on:**
- `docs/superpowers/plans/2026-10-21-delivery-00-foundation.md` (Prisma client, `storeId` session/middleware).
- `docs/superpowers/plans/2026-10-21-delivery-01-menu.md` Task 5 (`calculateItemPrice`, `PricingError`) — order creation calls this per line item.

## Global Constraints

- `OrderStatus` is the single enum covering payment + kitchen + delivery (spec 01's explicit decision) — never introduce a second parallel status enum.
- Every transition is validated by a pure `canTransition(current, next, channel)` function, never inline conditionals in a route handler (spec 02).
- The server never trusts a client-sent price; every line item's price comes from `calculateItemPrice` (Menu plan Task 5) recomputed from the current menu at order-creation time (spec 02).
- Realtime events are scoped per store (`store:{storeId}` and sub-rooms); a client must never receive another store's event (spec 02 — this is the multi-tenant isolation boundary for the realtime layer, not just the database).
- Realtime event payload stays minimal: `{ type: 'order_status_changed', orderId, status, channel, updatedAt }` — no customer address or other sensitive fields in the broadcast (spec 02).

## Review Focus

- **Invalid transition accepted:** e.g. jumping `RECEIVED` straight to `DELIVERED`, or transitioning a `CANCELED`/`COMPLETED` order at all — test: `canTransition` rejects every non-adjacent and post-terminal transition for each channel.
- **DELIVERY-only states applied to PDV/SALAO:** `OUT_FOR_DELIVERY`/`DELIVERED` must not be reachable for `PDV`/`SALAO` orders — test: `canTransition("READY", "OUT_FOR_DELIVERY", "PDV")` is false.
- **SALAO order missing `tableNumber`:** order creation for `channel: "SALAO"` without `tableNumber` must be rejected — test: 400 on missing required channel-specific field.
- **Cross-store realtime leak:** a socket authenticated for store A joining `store:{B}:kds` must be refused — test: join attempt for a room whose `storeId` doesn't match the socket's session is rejected, not silently allowed.
- **Price tampering attempt:** a creation request that includes an inflated/deflated price on a line item must be ignored — test: order total reflects server-recalculated price even when the request body carries a different number.

---

## File Structure

- `prisma/schema.prisma` — append `OrderChannel`, `OrderStatus` enums and `Order`, `OrderItem`, `OrderStatusEvent` models (spec 01 verbatim).
- `src/lib/orders/stateMachine.ts` — `canTransition`.
- `src/lib/orders/createOrder.ts` — order-creation use case (pricing + persistence).
- `src/app/api/stores/[storeId]/orders/route.ts` (POST create, GET list with `?status=active`)
- `src/app/api/stores/[storeId]/orders/[orderId]/status/route.ts` (PATCH transition)
- `src/server/realtime.ts` — WebSocket server setup, room management, `publishOrderEvent`.
- `src/app/(dashboard)/[store]/kds/page.tsx` — minimal KDS UI.
- Tests mirror each file under `tests/orders/...`.

## Task 1: Order schema + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Test: `tests/orders/schema.test.ts`

**Interfaces:**
- Consumes: `Store` (Foundation), `Product` (Menu Task 1 — `OrderItem.productId` is a plain string reference, not a hard FK, since a product may later be deleted/renamed; the order keeps a price/name snapshot per spec 02's "never trust client price, snapshot at creation" intent).
- Produces: `OrderChannel`, `OrderStatus` enums and `Order`, `OrderItem`, `OrderStatusEvent` models exactly as spec 01 defines — every later task in this plan reads/writes these.

- [ ] **Step 1: Append the enums and models to `prisma/schema.prisma`**

Copy `OrderChannel`, `OrderStatus`, `Order`, `OrderItem`, `OrderStatusEvent` verbatim from spec 01 "Pedidos" section.

- [ ] **Step 2: Generate and run the migration**

Run: `npx prisma migrate dev --name orders_schema`
Expected: exits 0.

- [ ] **Step 3: Write the schema smoke test**

```ts
import { prisma } from "@/lib/prisma";
import { describe, it, expect } from "vitest";

describe("order schema", () => {
  it("creates an order with an initial status event", async () => {
    const store = await prisma.store.create({ data: { slug: "order-schema-teste", name: "T" } });
    const order = await prisma.order.create({
      data: { storeId: store.id, channel: "PDV", subtotalCents: 1000, totalCents: 1000 },
    });
    expect(order.status).toBe("RECEIVED");
    await prisma.store.delete({ where: { id: store.id } });
  });
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/orders/schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations tests/orders/schema.test.ts
git commit -m "feat: add order schema (Order/OrderItem/OrderStatusEvent)"
```

## Task 2: `canTransition` state machine

**Files:**
- Create: `src/lib/orders/stateMachine.ts`
- Test: `tests/orders/stateMachine.test.ts`

**Interfaces:**
- Consumes: nothing (pure function).
- Produces: `canTransition(current: OrderStatus, next: OrderStatus, channel: OrderChannel): boolean` — Tasks 3 and 4 are the only callers; no other code implements transition logic.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { canTransition } from "@/lib/orders/stateMachine";

describe("canTransition", () => {
  it("allows the linear PDV path", () => {
    expect(canTransition("RECEIVED", "CONFIRMED", "PDV")).toBe(true);
    expect(canTransition("READY", "COMPLETED", "PDV")).toBe(true);
  });

  it("allows DELIVERY to pass through OUT_FOR_DELIVERY/DELIVERED", () => {
    expect(canTransition("READY", "OUT_FOR_DELIVERY", "DELIVERY")).toBe(true);
    expect(canTransition("OUT_FOR_DELIVERY", "DELIVERED", "DELIVERY")).toBe(true);
    expect(canTransition("DELIVERED", "COMPLETED", "DELIVERY")).toBe(true);
  });

  it("rejects OUT_FOR_DELIVERY for PDV/SALAO", () => {
    expect(canTransition("READY", "OUT_FOR_DELIVERY", "PDV")).toBe(false);
    expect(canTransition("READY", "OUT_FOR_DELIVERY", "SALAO")).toBe(false);
  });

  it("rejects skipping a step", () => {
    expect(canTransition("RECEIVED", "READY", "PDV")).toBe(false);
    expect(canTransition("RECEIVED", "DELIVERED", "DELIVERY")).toBe(false);
  });

  it("allows CANCELED from any pre-COMPLETED state", () => {
    expect(canTransition("CONFIRMED", "CANCELED", "PDV")).toBe(true);
    expect(canTransition("OUT_FOR_DELIVERY", "CANCELED", "DELIVERY")).toBe(true);
  });

  it("rejects any transition out of a terminal state", () => {
    expect(canTransition("COMPLETED", "CANCELED", "PDV")).toBe(false);
    expect(canTransition("CANCELED", "RECEIVED", "PDV")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/orders/stateMachine.test.ts`
Expected: FAIL ("canTransition is not a function").

- [ ] **Step 3: Implement `canTransition` in `src/lib/orders/stateMachine.ts`**

Define the linear order per channel from spec 02: `PDV`/`SALAO` → `RECEIVED, CONFIRMED, PREPARING, READY, COMPLETED`; `DELIVERY`/`AGENDADO` → `RECEIVED, CONFIRMED, PREPARING, READY, OUT_FOR_DELIVERY, DELIVERED, COMPLETED`. `canTransition` returns true only for `next` being the immediate successor of `current` in that channel's sequence, or `next === "CANCELED"` when `current` is not `COMPLETED`/`CANCELED`; `current === COMPLETED || current === CANCELED` always returns false.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/orders/stateMachine.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/orders/stateMachine.ts tests/orders/stateMachine.test.ts
git commit -m "feat: add order status state machine"
```

## Task 3: Order creation (server-side pricing)

**Files:**
- Create: `src/lib/orders/createOrder.ts`
- Create: `src/app/api/stores/[storeId]/orders/route.ts` (POST, GET)
- Test: `tests/orders/createOrder.test.ts`

**Interfaces:**
- Consumes: `calculateItemPrice`/`PricingError` (Menu plan Task 5), `prisma`.
- Produces: `createOrder(storeId: string, input: CreateOrderInput): Promise<Order>` where `CreateOrderInput` matches spec 02's payload shape (`channel, tableNumber?, scheduledFor?, customerId?, deliveryAddress?, items: LineItemSelection[], couponCode?, paymentMethod?`); throws on missing channel-specific required fields or on any `PricingError` bubbled from pricing a line item. The route handler is the only HTTP entry point; Task 4 and the realtime layer consume the returned `Order`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { createOrder } from "@/lib/orders/createOrder";

describe("createOrder", () => {
  let storeId: string, productId: string;
  beforeEach(async () => {
    storeId = (await prisma.store.create({ data: { slug: "create-order-teste", name: "T" } })).id;
    productId = (await prisma.product.create({ data: { storeId, name: "Suco", priceCents: 800 } })).id;
  });
  afterEach(async () => { await prisma.store.delete({ where: { id: storeId } }); });

  it("creates a PDV order and recalculates price from the menu, ignoring a tampered client price", async () => {
    const order = await createOrder(storeId, {
      channel: "PDV",
      items: [{ productId, quantity: 2, selectedAddonIds: [], clientSentPriceCents: 1 } as any],
    });
    expect(order.totalCents).toBe(1600); // 2 x 800, not the tampered value
  });

  it("rejects a SALAO order without tableNumber", async () => {
    await expect(createOrder(storeId, { channel: "SALAO", items: [{ productId, quantity: 1, selectedAddonIds: [] }] } as any))
      .rejects.toThrow();
  });

  it("writes an initial OrderStatusEvent", async () => {
    const order = await createOrder(storeId, { channel: "PDV", items: [{ productId, quantity: 1, selectedAddonIds: [] }] });
    const events = await prisma.orderStatusEvent.findMany({ where: { orderId: order.id } });
    expect(events).toHaveLength(1);
    expect(events[0].status).toBe("RECEIVED");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/orders/createOrder.test.ts`
Expected: FAIL (`createOrder is not a function`).

- [ ] **Step 3: Implement `createOrder` in `src/lib/orders/createOrder.ts`**

Validate channel-specific required fields (`SALAO` → `tableNumber`, `AGENDADO` → `scheduledFor`, `DELIVERY` → `deliveryAddress`); for each item, fetch its `Product` + addons (scoped by `storeId`) and call `calculateItemPrice`, ignoring any price field the client sent; sum into `subtotalCents`/`totalCents` (apply `discountCents`/`deliveryFeeCents` only when the plan explicitly adds coupon/delivery-fee logic — out of scope here, default both to 0); persist `Order` + `OrderItem[]` + one `OrderStatusEvent{ status: "RECEIVED" }` in a single `prisma.$transaction`.

- [ ] **Step 4: Implement the route handler**

`POST`: parse body, call `createOrder`, return 201 with the order or 400 with the thrown error's message. `GET`: `?status=active` maps to `status: { notIn: ["COMPLETED", "CANCELED"] }` (spec 02's reconciliation endpoint, used by Task 8).

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/orders/createOrder.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/orders/createOrder.ts src/app/api/stores/[storeId]/orders/route.ts tests/orders/createOrder.test.ts
git commit -m "feat: add order creation with server-side pricing"
```

## Task 4: Order status transition endpoint

**Files:**
- Create: `src/app/api/stores/[storeId]/orders/[orderId]/status/route.ts`
- Test: `tests/orders/statusTransition.test.ts`

**Interfaces:**
- Consumes: `canTransition` (Task 2), `prisma`.
- Produces: `PATCH /api/stores/:storeId/orders/:orderId/status` body `{ status: OrderStatus }` → 200 with the updated order, or 409 when `canTransition` rejects the move. On success, writes an `OrderStatusEvent` and calls `publishOrderEvent` (Task 6) — this route is the single place that fires realtime events for order status.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { PATCH } from "@/app/api/stores/[storeId]/orders/[orderId]/status/route";

describe("order status transition endpoint", () => {
  let storeId: string, orderId: string;
  beforeEach(async () => {
    storeId = (await prisma.store.create({ data: { slug: "status-teste", name: "T" } })).id;
    const order = await prisma.order.create({ data: { storeId, channel: "PDV", subtotalCents: 100, totalCents: 100 } });
    orderId = order.id;
  });
  afterEach(async () => { await prisma.store.delete({ where: { id: storeId } }); });

  it("accepts a valid transition and records the event", async () => {
    const res = await PATCH(new Request("http://x", { method: "PATCH", body: JSON.stringify({ status: "CONFIRMED" }) }), { params: { storeId, orderId } } as any);
    expect(res.status).toBe(200);
    const events = await prisma.orderStatusEvent.findMany({ where: { orderId } });
    expect(events.map(e => e.status)).toContain("CONFIRMED");
  });

  it("rejects an invalid transition with 409", async () => {
    const res = await PATCH(new Request("http://x", { method: "PATCH", body: JSON.stringify({ status: "DELIVERED" }) }), { params: { storeId, orderId } } as any);
    expect(res.status).toBe(409);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/orders/statusTransition.test.ts`
Expected: FAIL (route module doesn't exist).

- [ ] **Step 3: Implement the route handler**

Load the order scoped by `(storeId, orderId)` (404 if not found), call `canTransition(order.status, body.status, order.channel)`; on `false` return 409; on `true`, `prisma.$transaction` updating `Order.status` and creating the `OrderStatusEvent`, then call `publishOrderEvent` (Task 6 — stub it with a no-op export for now if Task 6 isn't implemented yet in execution order; the final wiring happens in Task 6).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/orders/statusTransition.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/stores/[storeId]/orders/[orderId]/status tests/orders/statusTransition.test.ts
git commit -m "feat: add order status transition endpoint"
```

## Task 5: WebSocket server setup (builder call)

**Files:**
- Create: `src/server/realtime.ts`
- Test: `tests/server/realtime.test.ts`

**Interfaces:**
- Consumes: next-auth session/JWT (Foundation Task 6) for socket auth.
- Produces: `createRealtimeServer(httpServer): RealtimeServer` with `RealtimeServer.joinRoom(socketId, room: string, sessionStoreIds: string[]): boolean` as the pure, testable authorization core (room name encodes `storeId`; join is rejected when the room's `storeId` isn't in `sessionStoreIds` — same shape as Foundation Task 7's `evaluateTenantGuard`), and `RealtimeServer.broadcast(room: string, event: OrderRealtimeEvent)`.

- [ ] **Step 1: Builder call — `ws` vs `socket.io`, and hosting model**

Spec 02 explicitly leaves this open. Decide and record in the PR: (a) library — `socket.io` is recommended for its built-in room primitive and reconnection handling, matching this plan's `joinRoom`/room-per-store design directly; `ws` would require hand-rolling both. (b) hosting — verify whether the Next 16 version pinned in Foundation Task 1 supports a WebSocket upgrade inside an App Router route handler; if not (historically the common case), run a small custom Node server (`server.ts`) that wraps the Next request handler and attaches `socket.io` to the same HTTP server, and update `package.json`'s `dev`/`start` scripts to launch it instead of `next dev`/`next start`. Document whichever path was taken.

- [ ] **Step 2: Write the failing tests for the pure authorization core**

```ts
import { describe, it, expect } from "vitest";
import { canJoinRoom } from "@/server/realtime";

describe("canJoinRoom", () => {
  it("allows joining a room for a store the session has access to", () => {
    expect(canJoinRoom("store:store-a:kds", ["store-a"])).toBe(true);
  });
  it("rejects joining a room for a store outside the session", () => {
    expect(canJoinRoom("store:store-b:kds", ["store-a"])).toBe(false);
  });
  it("rejects a malformed room name", () => {
    expect(canJoinRoom("not-a-room", ["store-a"])).toBe(false);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- tests/server/realtime.test.ts`
Expected: FAIL ("canJoinRoom is not a function").

- [ ] **Step 4: Implement `canJoinRoom` and the server wiring in `src/server/realtime.ts`**

`canJoinRoom(room, sessionStoreIds)`: parse `room` as `store:{storeId}(:kds|:orders|:delivery:{deliveryPersonId})?`; return false on parse failure; otherwise `sessionStoreIds.includes(storeId)`. Wire the chosen library (Task 5 Step 1) so every `join` event calls `canJoinRoom` before actually joining, and expose `broadcast(room, event)` for Task 6 to call.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/server/realtime.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/server/realtime.ts tests/server/realtime.test.ts package.json
git commit -m "feat: add WebSocket server with tenant-scoped room authorization"
```

## Task 6: Wire `publishOrderEvent` into the status transition

**Files:**
- Modify: `src/app/api/stores/[storeId]/orders/[orderId]/status/route.ts`
- Create: `src/lib/orders/publishOrderEvent.ts`
- Test: `tests/orders/publishOrderEvent.test.ts`

**Interfaces:**
- Consumes: `RealtimeServer.broadcast` (Task 5).
- Produces: `publishOrderEvent(storeId: string, order: Order): void` — builds `{ type: 'order_status_changed', orderId: order.id, status: order.status, channel: order.channel, updatedAt: order.updatedAt }` and broadcasts it to `store:{storeId}:kds`, `store:{storeId}:orders`, and — when `order.deliveryId` is set — `store:{storeId}:delivery:{order.deliveryId}`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { publishOrderEvent } from "@/lib/orders/publishOrderEvent";
import * as realtime from "@/server/realtime";

describe("publishOrderEvent", () => {
  it("broadcasts to kds and orders rooms, and the delivery room when assigned", () => {
    const broadcast = vi.spyOn(realtime, "broadcast").mockImplementation(() => {});
    publishOrderEvent("store-a", { id: "o1", status: "READY", channel: "DELIVERY", updatedAt: new Date(), deliveryId: "d1" } as any);
    const rooms = broadcast.mock.calls.map(c => c[0]);
    expect(rooms).toContain("store:store-a:kds");
    expect(rooms).toContain("store:store-a:orders");
    expect(rooms).toContain("store:store-a:delivery:d1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/orders/publishOrderEvent.test.ts`
Expected: FAIL ("publishOrderEvent is not a function").

- [ ] **Step 3: Implement `publishOrderEvent`, replace Task 4's stub with a real call**

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/orders/publishOrderEvent.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/orders/publishOrderEvent.ts src/app/api/stores/[storeId]/orders/[orderId]/status tests/orders/publishOrderEvent.test.ts
git commit -m "feat: broadcast order status transitions to tenant-scoped rooms"
```

## Task 7: Minimal KDS UI

**Files:**
- Create: `src/app/(dashboard)/[store]/kds/page.tsx`
- Test: none required (manual verification, same rationale as Menu plan Task 6)

**Interfaces:**
- Consumes: `GET .../orders?status=active` (Task 3), `store:{storeId}:kds` WebSocket room (Task 5/6).

- [ ] **Step 1: Build the KDS page**

Client component: on mount, fetch `?status=active` orders filtered to `CONFIRMED`/`PREPARING`, join the `kds` room, update the list on incoming `order_status_changed` events (merge by `orderId`, or refetch on reconnect per spec 02's reconciliation rule); render one "advance status" button per order calling Task 4's PATCH with the next status in that order's channel sequence.

- [ ] **Step 2: Manually verify in a browser**

Create an order via the API (or Menu/Orders UI), open the KDS page, advance its status, confirm the card updates without a page reload.

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/[store]/kds
git commit -m "feat: add minimal KDS UI"
```

---

## Self-Review Notes

- **Spec coverage:** state machine, order payload, price recalculation, realtime rooms/events, reconciliation fallback, and KDS behavior from spec 02 are all covered (Tasks 1–7). `AGENDADO`'s "wait until `scheduledFor` approaches" nuance is left as a future job/cron task, not silently dropped — flagged here since spec 02 itself leaves its exact mechanism open.
- **Step scan:** every code step gives an exact signature; Task 5's library/hosting choice is explicitly marked as a builder call with both parts (library, hosting) resolved by a decision rule, not left as "TBD."
- **Type consistency:** `canTransition(current, next, channel)` signature, `publishOrderEvent(storeId, order)`, and the realtime event shape `{ type, orderId, status, channel, updatedAt }` are used identically across Tasks 2, 4, 6, 7.
- **Review Focus:** all 5 lines map to tests — invalid/skip transitions and DELIVERY-only states (Task 2), SALAO missing field and price tampering (Task 3), cross-store room join (Task 5).
- **Proportion:** plan length tracks spec 02's length; Task 7 stays at interface/acceptance level per the same UI rationale as the Menu plan.
