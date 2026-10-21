# Delivery Platform — Onboarding, Impressão Local, Infra/Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the 8-step guided onboarding (non-blocking except step 1), the local print-agent integration contract, and the Docker Compose deploy stack on the VPS — the last pieces needed before the first real tenant can be onboarded end-to-end.

**Architecture:** `StoreOnboardingProgress` is a single row per store with eight booleans; each step's "done" flag is set by the route that completes that step's real action (creating the store, saving payment config, etc.), not by a separate "mark done" endpoint, so progress can never drift from what's actually configured. Printing is entirely client-side (browser → `127.0.0.1:5000`); the backend never touches it. Deploy is a dedicated Docker Compose stack, fully separate from every other project's containers/network/volumes on the same VPS.

**Tech Stack:** Next 16, Prisma 6, Docker Compose, Caddy (or equivalent) for TLS + wildcard subdomain.

**Spec:** `docs/superpowers/specs/2026-10-21-delivery-design-05-onboarding-infra-deploy.md`, with the `StoreOnboardingProgress` model from `2026-10-21-delivery-design-01-domain-model.md` — executors read both.

**Depends on:**
- `docs/superpowers/plans/2026-10-21-delivery-00-foundation.md` (`Store`, session, `CREDENTIALS_KEY` pattern).
- `docs/superpowers/plans/2026-10-21-delivery-01-menu.md` through `2026-10-21-delivery-04-marketing-atendimento-entregas.md` (onboarding steps 2–7 flip booleans that correspond to actions those plans implement: payment config, delivery zones, WhatsApp instance, etc.) — this plan's step-completion hooks assume those routes already exist.

## Global Constraints

- Onboarding is non-blocking except step 1 (`Store` must exist before anything else) — no route in this plan may hard-block access to the dashboard because a later step is incomplete (spec 05).
- The backend never calls the local print agent; only the browser does (spec 05) — no server-side code may attempt to reach `127.0.0.1:5000`.
- Deploy never shares a container, network, volume, or database with any other project on the VPS (spec 00 anti-goal, spec 05) — the Compose file defines its own named network/volumes.
- Any credential in the Compose/env setup (`DATABASE_URL`, `CREDENTIALS_KEY`, Mercado Pago/Evolution secrets) is injected via environment, never committed to the repo (standard practice, implied by spec 05's `CREDENTIALS_KEY` reuse).

## Review Focus

- **Onboarding step flag set without the real action happening:** e.g. `step2PaymentDone = true` persisted without a payment method actually configured — test: the step-2 completion hook only flips the flag as a side effect of the real payment-config save call, verified by calling the save endpoint and checking the flag, not by a direct flag-setter test.
- **Dashboard blocked by incomplete non-blocking steps:** a store with only step 1 done must still be able to reach the dashboard and use menu/orders — test: a store with steps 2–8 all `false` is not redirected away from the dashboard.
- **Store accessible before step 1:** there is no path to create `StoreOnboardingProgress` without first creating the `Store` — test: progress row creation is always a side effect of store creation, never callable standalone.
- **Review completion (`step8ReviewDone`) settable before earlier steps:** completing step 8 when step 1 isn't done is nonsensical — test: review completion requires step 1 at minimum (the other six remain non-blocking per spec, but step 1 is the one hard prerequisite spec 05 names).
- **Print payload contract silently assumed:** no server code may assume a fixed print-agent payload shape without the implementer explicitly documenting the chosen contract in the PR (spec 05 marks this unverified) — this plan's Task 2 step explicitly requires that documentation, checked by review, not by an automated test.

---

## File Structure

- `prisma/schema.prisma` — append `StoreOnboardingProgress` (spec 01 verbatim).
- `src/lib/onboarding/progress.ts` — `createOnboardingProgress`, `markStepDone`, `requiresBlockingStep1`.
- `src/app/api/stores/route.ts` (POST creates `Store` + `StoreOnboardingProgress` together — step 1).
- `src/app/api/stores/[storeId]/onboarding/route.ts` (GET progress).
- `src/lib/print/buildPrintPayload.ts` — client-side payload builder (runs in the browser bundle, not a server route).
- `docker-compose.yml`, `.env.production.example`, `Caddyfile` (or chosen proxy config) at repo root.
- `src/app/(dashboard)/[store]/onboarding/page.tsx` — guided wizard UI.
- Tests mirror each file under `tests/onboarding/...`.

## Task 1: `StoreOnboardingProgress` schema + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Test: `tests/onboarding/schema.test.ts`

**Interfaces:**
- Consumes: `Store` (Foundation).
- Produces: `StoreOnboardingProgress` model exactly as spec 01/05 defines (8 booleans + `completedAt`).

- [ ] **Step 1: Append the model**

Copy verbatim from spec 05.

- [ ] **Step 2: Generate and run the migration**

Run: `npx prisma migrate dev --name onboarding_schema`
Expected: exits 0.

- [ ] **Step 3: Write the schema smoke test**

```ts
import { prisma } from "@/lib/prisma";
import { describe, it, expect } from "vitest";

describe("onboarding schema", () => {
  it("creates a progress row with all steps false by default", async () => {
    const store = await prisma.store.create({ data: { slug: "onboard-schema-teste", name: "T" } });
    const progress = await prisma.storeOnboardingProgress.create({ data: { storeId: store.id } });
    expect(progress.step1EstablishmentDone).toBe(false);
    await prisma.store.delete({ where: { id: store.id } });
  });
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/onboarding/schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations tests/onboarding/schema.test.ts
git commit -m "feat: add StoreOnboardingProgress schema"
```

## Task 2: Store creation (step 1) + progress row

**Files:**
- Create: `src/app/api/stores/route.ts`
- Create: `src/lib/onboarding/progress.ts`
- Test: `tests/onboarding/createStore.test.ts`

**Interfaces:**
- Consumes: `prisma`, `Store`/`StoreOnboardingProgress` (Task 1).
- Produces: `createStoreWithOnboarding(input: { slug, name, foodCategory }): Promise<{ store: Store; progress: StoreOnboardingProgress }>` — creates both rows in one transaction with `step1EstablishmentDone: true` (the act of creating the store *is* completing step 1 — no separate flag-setter exists for it, per Review Focus line 1's pattern). `markStepDone(storeId, step: OnboardingStepKey): Promise<void>` is the generic helper every later step-completion hook (in the Menu/Finance/Marketing plans' routes) calls.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createStoreWithOnboarding, markStepDone } from "@/lib/onboarding/progress";

describe("createStoreWithOnboarding", () => {
  let storeId: string;
  afterEach(async () => { if (storeId) await prisma.store.delete({ where: { id: storeId } }); });

  it("creates a store with step 1 already marked done", async () => {
    const { store, progress } = await createStoreWithOnboarding({ slug: "nova-loja", name: "Nova Loja", foodCategory: "pizzaria" });
    storeId = store.id;
    expect(progress.step1EstablishmentDone).toBe(true);
    expect(progress.step2PaymentDone).toBe(false);
  });

  it("markStepDone flips exactly the named step", async () => {
    const { store } = await createStoreWithOnboarding({ slug: "loja-mark", name: "Loja Mark", foodCategory: "lanches" });
    storeId = store.id;
    await markStepDone(storeId, "step3HoursDone");
    const progress = await prisma.storeOnboardingProgress.findUniqueOrThrow({ where: { storeId } });
    expect(progress.step3HoursDone).toBe(true);
    expect(progress.step4DeliveryAreaDone).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/onboarding/createStore.test.ts`
Expected: FAIL ("createStoreWithOnboarding is not a function").

- [ ] **Step 3: Implement `createStoreWithOnboarding` and `markStepDone` in `src/lib/onboarding/progress.ts`**

`OnboardingStepKey` is a union type of the 8 field names. `markStepDone` does `prisma.storeOnboardingProgress.update({ where: { storeId }, data: { [step]: true } })`.

- [ ] **Step 4: Implement the `POST /api/stores` route handler**

Calls `createStoreWithOnboarding`, returns 201.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/onboarding/createStore.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/onboarding/progress.ts src/app/api/stores/route.ts tests/onboarding/createStore.test.ts
git commit -m "feat: add store creation with onboarding progress tracking"
```

## Task 3: Wire `markStepDone` into steps 2–7's existing routes

**Files:**
- Modify: `src/app/api/stores/[storeId]/finance/accounts/route.ts` (Financeiro plan Task 4 — first `BankAccount`/payment config save → step 2)
- Modify: a store-hours settings route (new, minimal — see Step 1 below) → step 3
- Modify: `src/app/api/stores/[storeId]/delivery-zones/route.ts` (Marketing plan Task 7 — first zone created) → step 4
- Modify: `src/app/api/stores/[storeId]/whatsapp/route.ts` (Marketing plan Task 8) → step 5
- Modify: a delivery-time settings route (new, minimal — see Step 1) → step 6
- Modify: a salão-structure settings route (new, minimal — see Step 1) → step 7
- Test: `tests/onboarding/stepWiring.test.ts`

**Interfaces:**
- Consumes: `markStepDone` (Task 2).
- Produces: three new minimal settings endpoints (hours, delivery time estimate, salão structure) that spec 05 names but no earlier plan created a home for; each is a single `Store`-scoped settings blob, not modeled in depth here since spec 05 doesn't specify their exact fields beyond the onboarding step names.

- [ ] **Step 1: Builder call — minimal settings fields for steps 3, 6, 7**

Spec 05 names these steps but not their exact data shape. Add the simplest fields that satisfy the step's stated purpose: step 3 (`hours`) → a `Store.businessHours: Json` field (array of `{ day, opensAt, closesAt }`); step 6 (`delivery time`) → `Store.estimatedDeliveryMinutes: Int?`; step 7 (`salão structure`) → `Store.tableCount: Int?` and `Store.hasPdv: Boolean @default(false)`. Add these as direct `Store` fields (not new models — spec 05 treats them as simple configuration, not a relation) via a migration, each with a minimal `PATCH /api/stores/:storeId/settings` route.

- [ ] **Step 2: Write the failing test**

```ts
import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createStoreWithOnboarding } from "@/lib/onboarding/progress";
import { PATCH } from "@/app/api/stores/[storeId]/settings/route";

describe("step wiring via settings route", () => {
  let storeId: string;
  afterEach(async () => { await prisma.store.delete({ where: { id: storeId } }); });

  it("marks step3HoursDone when business hours are saved", async () => {
    const { store } = await createStoreWithOnboarding({ slug: "wiring-teste", name: "T", foodCategory: "x" });
    storeId = store.id;
    await PATCH(new Request("http://x", { method: "PATCH", body: JSON.stringify({ businessHours: [{ day: "MON", opensAt: "11:00", closesAt: "23:00" }] }) }), { params: { storeId } } as any);
    const progress = await prisma.storeOnboardingProgress.findUniqueOrThrow({ where: { storeId } });
    expect(progress.step3HoursDone).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- tests/onboarding/stepWiring.test.ts`
Expected: FAIL (route doesn't exist).

- [ ] **Step 4: Implement the settings route and add the `markStepDone` calls**

New `src/app/api/stores/[storeId]/settings/route.ts` handles `businessHours`/`estimatedDeliveryMinutes`/`tableCount`+`hasPdv`, calling `markStepDone` for the corresponding step whenever that field is present in the request. Add one `markStepDone(storeId, "step2PaymentDone")` call to the Financeiro plan's bank-account creation handler, one `markStepDone(storeId, "step4DeliveryAreaDone")` call to the Marketing plan's delivery-zone creation handler, one `markStepDone(storeId, "step5BotDone")` call to the Marketing plan's WhatsApp-instance creation handler.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/onboarding/stepWiring.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/app/api/stores/[storeId]/settings src/app/api/stores/[storeId]/finance/accounts src/app/api/stores/[storeId]/delivery-zones src/app/api/stores/[storeId]/whatsapp tests/onboarding/stepWiring.test.ts
git commit -m "feat: wire onboarding step completion into existing config routes"
```

## Task 4: Final review (step 8) + non-blocking dashboard access

**Files:**
- Create: `src/lib/onboarding/progress.ts` (extend — `completeReview`, `canAccessDashboard`)
- Test: `tests/onboarding/review.test.ts`

**Interfaces:**
- Consumes: `StoreOnboardingProgress` (Task 1).
- Produces: `completeReview(storeId): Promise<void>` — sets `step8ReviewDone: true` and `completedAt: now()`, throwing if `step1EstablishmentDone` is false (Review Focus line 4; the other six steps are not required, per spec 05's "non-blocking" rule). `canAccessDashboard(progress: StoreOnboardingProgress): boolean` — `true` whenever `step1EstablishmentDone`, regardless of the other seven (Review Focus line 2).

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createStoreWithOnboarding, completeReview, canAccessDashboard } from "@/lib/onboarding/progress";

describe("review completion and dashboard access", () => {
  let storeId: string;
  afterEach(async () => { await prisma.store.delete({ where: { id: storeId } }); });

  it("allows dashboard access with only step 1 done", async () => {
    const { progress } = await createStoreWithOnboarding({ slug: "review-teste", name: "T", foodCategory: "x" });
    storeId = progress.storeId;
    expect(canAccessDashboard(progress)).toBe(true);
  });

  it("completeReview sets completedAt when step 1 is done", async () => {
    const { store } = await createStoreWithOnboarding({ slug: "review-teste-2", name: "T", foodCategory: "x" });
    storeId = store.id;
    await completeReview(storeId);
    const progress = await prisma.storeOnboardingProgress.findUniqueOrThrow({ where: { storeId } });
    expect(progress.step8ReviewDone).toBe(true);
    expect(progress.completedAt).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/onboarding/review.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `completeReview` and `canAccessDashboard`**

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/onboarding/review.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/onboarding/progress.ts tests/onboarding/review.test.ts
git commit -m "feat: add onboarding review completion and non-blocking dashboard access check"
```

## Task 5: Local print-agent payload contract

**Files:**
- Create: `src/lib/print/buildPrintPayload.ts` (runs client-side, bundled into the dashboard UI)
- Test: `tests/print/buildPrintPayload.test.ts`

**Interfaces:**
- Consumes: `Order`/`OrderItem` (Orders/Menu plans), called from browser code only.
- Produces: `buildPrintPayload(order: Order, items: OrderItem[]): PrintPayload` where `PrintPayload = { templateId: "comanda" | "recibo"; data: { orderId, channel, tableNumber, items: { name, quantity, unitPriceCents, addons }[], totalCents } }` — **builder call, unverified against the real agent**: if the client already has a specific print agent expecting a different shape, adapt this function's output to match it instead of keeping this contract (spec 05 explicit instruction, Review Focus line 5). The browser code that calls `fetch("http://127.0.0.1:5000/print", { method: "POST", body: JSON.stringify(buildPrintPayload(...)) })` lives in the KDS/order-detail UI (Orders plan), not in this plan's files — this plan only defines the payload shape.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { buildPrintPayload } from "@/lib/print/buildPrintPayload";

describe("buildPrintPayload", () => {
  it("builds a comanda payload from an order and its items", () => {
    const order = { id: "o1", channel: "SALAO", tableNumber: "5", totalCents: 4500 } as any;
    const items = [{ productId: "p1", quantity: 2, unitPriceCents: 1500, addons: [] }] as any;
    const payload = buildPrintPayload(order, items);
    expect(payload.templateId).toBe("comanda");
    expect(payload.data.tableNumber).toBe("5");
    expect(payload.data.totalCents).toBe(4500);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/print/buildPrintPayload.test.ts`
Expected: FAIL ("buildPrintPayload is not a function").

- [ ] **Step 3: Implement `buildPrintPayload`**

`templateId` is `"comanda"` for `SALAO`/`PDV` (kitchen ticket), `"recibo"` for completed orders of any channel (customer receipt) — exact rule left to the implementer's judgment within that split, since spec 05 doesn't fix it further.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/print/buildPrintPayload.test.ts`
Expected: PASS.

- [ ] **Step 5: Document the real contract once verified**

When the implementer actually wires the browser `fetch` call against the client's print agent, update this task's docstring (or a short note in `docs/superpowers/specs/2026-10-21-delivery-design-05-onboarding-infra-deploy.md`) with the confirmed real payload shape — required by this plan's Review Focus line 5, not optional polish.

- [ ] **Step 6: Commit**

```bash
git add src/lib/print/buildPrintPayload.ts tests/print/buildPrintPayload.test.ts
git commit -m "feat: add local print-agent payload builder"
```

## Task 6: Guided onboarding UI

**Files:**
- Create: `src/app/(dashboard)/[store]/onboarding/page.tsx`
- Test: none required (manual verification, same rationale as prior plans)

**Interfaces:**
- Consumes: `GET .../onboarding` progress, `markStepDone`/`completeReview` indirectly via the existing config routes (Tasks 2–4).

- [ ] **Step 1: Build the wizard page**

8 sections matching spec 05's step list, each linking to the real config screen (menu, payment/finance, settings, delivery zones, whatsapp, settings, settings, review); a progress indicator reads `GET .../onboarding` and shows which are done; nothing here is blocking except that step 1 is a precondition for the store existing at all.

- [ ] **Step 2: Manually verify in a browser**

Create a store, confirm step 1 shows done immediately; configure a bank account, a delivery zone, and a WhatsApp instance through their real screens and confirm the wizard reflects steps 2/4/5 as done without any manual "mark done" click; confirm the dashboard (menu/orders) is reachable throughout, never gated.

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/[store]/onboarding
git commit -m "feat: add guided onboarding wizard UI"
```

## Task 7: Docker Compose deploy stack

**Files:**
- Create: `docker-compose.yml`, `.env.production.example`, `Caddyfile`
- Test: none required (infra verification is manual/operational, not unit-testable)

**Interfaces:**
- Consumes: nothing from the codebase; this is deploy configuration.
- Produces: a self-contained Compose stack — services `app` (Next, built from a `Dockerfile` this task also creates), `db` (Postgres, named volume `delivery_db_data`), `cron` (same image as `app`, running scheduled jobs — e.g. the sales-recovery job from the Marketing plan — entrypoint TBD by whichever scheduler the implementer picks, since none was decided in brainstorming), `backup` (periodic `pg_dump` to a mounted volume), and a reverse proxy service terminating TLS for the wildcard subdomain. Network name `delivery_net`, volumes `delivery_db_data`/`delivery_backups` — all prefixed to avoid any collision with `ecomerce` or other projects' Compose stacks on the same VPS (spec 00/05 anti-goal).

- [ ] **Step 1: Write the `Dockerfile`**

Multi-stage Next 16 production build (`npm ci`, `npm run build`, copy `.next`/`public`/`node_modules` into a slim runtime stage).

- [ ] **Step 2: Write `docker-compose.yml`**

Define the five services above with `delivery_net`/`delivery_db_data`/`delivery_backups` names; `app` depends on `db`; environment variables (`DATABASE_URL`, `CREDENTIALS_KEY`, Mercado Pago/Evolution secrets) sourced from `.env.production` (not committed — `.env.production.example` documents the keys only).

- [ ] **Step 3: Write the proxy config**

`Caddyfile` with a wildcard subdomain block (`*.dominio.com`) proxying to `app`'s port, TLS via Caddy's automatic HTTPS.

- [ ] **Step 4: Manually verify on the VPS**

SSH to `192.168.0.233`, confirm no existing `ecomerce`/`sysdoc` container, network, or volume name collides with the ones this stack defines (`docker network ls`, `docker volume ls`); run `docker compose up -d`, confirm `app`/`db` come up healthy and a test subdomain resolves through the proxy.

- [ ] **Step 5: Commit**

```bash
git add Dockerfile docker-compose.yml .env.production.example Caddyfile
git commit -m "chore: add Docker Compose deploy stack"
```

---

## Self-Review Notes

- **Spec coverage:** all 8 onboarding steps, the print-agent contract (explicitly marked unverified per spec's own instruction), repo setup (already resolved — not a task here, see Foundation plan handoff), and infra/deploy from spec 05 are covered (Tasks 1–7).
- **Step scan:** every code step gives an exact signature; Task 3 Step 1 and Task 5 are explicitly marked as builder calls with the reasoning spelled out, not left as bare "TBD."
- **Type consistency:** `markStepDone(storeId, step: OnboardingStepKey)` signature from Task 2 is reused unchanged by every wiring call in Task 3; `PrintPayload` shape from Task 5 is what the Orders-plan UI (out of this plan's files) must call.
- **Review Focus:** all 5 lines map to tests or explicit documentation requirements — step-flag-without-action (Task 3's wiring test calls the real route, not a direct setter), non-blocking dashboard (Task 4), step-1 precondition before store exists (Task 2's transaction) and before review (Task 4), print contract documentation (Task 5 Step 5, a review-checked requirement rather than a test).
- **Proportion:** plan length tracks spec 05; Tasks 6–7 (UI, infra) stay at acceptance/operational-verification level since neither is unit-testable in the way domain logic is.
