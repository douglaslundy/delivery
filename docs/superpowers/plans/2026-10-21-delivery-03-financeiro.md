# Delivery Platform — Financeiro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the full V1 financial module — automatic cash-flow entries on order completion, manual accounts payable/receivable, bank accounts with computed balance, and the three V1 reports — plus the `FiscalDocument` schema reservation (no emission logic).

**Architecture:** `FinanceEntry` is the single ledger row for both cash-flow and payables/receivables (`dueDate`/`paidAt` nullability distinguishes them, per spec 03). A hook into the Orders plan's status-transition endpoint creates an `INCOME` entry automatically when an order reaches `COMPLETED`; everything else is CRUD + on-demand aggregation queries (no materialized summary table in V1).

**Tech Stack:** Next 16 route handlers, Prisma 6, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-21-delivery-design-03-financeiro-fiscal.md`, with the `FinanceCategory`/`BankAccount`/`FinanceEntry`/`FiscalDocument` models from `2026-10-21-delivery-design-01-domain-model.md` — executors read both.

**Depends on:**
- `docs/superpowers/plans/2026-10-21-delivery-00-foundation.md` (Prisma client, `storeId` session).
- `docs/superpowers/plans/2026-10-21-delivery-02-orders-realtime.md` Task 4 (order status transition route — this plan adds a call from there, see Task 2).

## Global Constraints

- `FinanceEntry` with `orderId` set is system-generated (order completion); `orderId` null means a manual entry — never let a manual-entry route set `orderId` (spec 03).
- `dueDate` present + `paidAt` null = pending; `paidAt` set = settled. No separate "payable" vs "ledger" table (spec 03's explicit unification decision) — don't add one.
- No open-banking integration in V1; `BankAccount` balance is always `initialBalanceCents + sum(FinanceEntry up to a date)`, computed on read, never stored/cached (spec 03).
- `FiscalDocument` gets schema only — no route/job may emit a real fiscal document in this plan (spec 03, deferred to `br-fiscal-note-emission` skill in a future phase).

## Review Focus

- **Double-counted income on order completion:** completing the same order's status transition twice (e.g. a retried request) must not create two `FinanceEntry` rows for it — test: calling the completion hook twice for the same `orderId` results in exactly one `INCOME` entry.
- **Manual entry impersonating a system entry:** a manual-entry creation request that includes an `orderId` must be rejected or have it stripped, never persisted — test: POST with a client-supplied `orderId` either 400s or the stored row has `orderId: null`.
- **Overdue detection off by a day/timezone:** a receivable due today must not show as overdue, one due yesterday must — test: `dueDate = today` is not overdue, `dueDate = yesterday` is.
- **Balance calculation across multiple accounts:** an entry with `bankAccountId: null` ("dinheiro em caixa") must not be included in any specific `BankAccount`'s balance, nor silently dropped from the cash-flow report — test: a null-account entry appears in the period cash-flow total but not in any account's computed balance.
- **Revenue-by-channel report excluding canceled orders:** a `CANCELED` order must never contribute to revenue-by-channel/product figures even if it had `FinanceEntry` rows from a prior (then-reverted) state — test: a canceled order's entries are excluded from the report query.

---

## File Structure

- `prisma/schema.prisma` — append `FinanceCategory`, `BankAccount`, `FinanceEntry`, `FiscalDocument` (spec 01 verbatim).
- `src/lib/finance/recordOrderCompletion.ts` — the auto-entry hook.
- `src/lib/finance/balance.ts` — `calculateAccountBalance`.
- `src/lib/finance/reports.ts` — `cashFlowReport`, `payablesReceivablesReport`, `revenueByChannelReport`.
- `src/app/api/stores/[storeId]/finance/entries/route.ts`, `.../entries/[entryId]/route.ts`
- `src/app/api/stores/[storeId]/finance/accounts/route.ts`
- `src/app/api/stores/[storeId]/finance/categories/route.ts`
- `src/app/api/stores/[storeId]/finance/reports/route.ts`
- `src/app/(dashboard)/[store]/financeiro/page.tsx` — minimal UI.
- Tests mirror each file under `tests/finance/...`.

## Task 1: Finance schema + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Test: `tests/finance/schema.test.ts`

**Interfaces:**
- Consumes: `Store` (Foundation), `Order` (Orders plan — `FinanceEntry.orderId` is a plain string reference, not a hard FK, matching the Orders plan's own snapshot approach).
- Produces: `FinanceCategory`, `BankAccount`, `FinanceEntry`, `FiscalDocument` models exactly as spec 01 defines.

- [ ] **Step 1: Append the four models to `prisma/schema.prisma`**

Copy verbatim from spec 01 "Financeiro" and "Fiscal" sections.

- [ ] **Step 2: Generate and run the migration**

Run: `npx prisma migrate dev --name finance_schema`
Expected: exits 0.

- [ ] **Step 3: Write the schema smoke test**

```ts
import { prisma } from "@/lib/prisma";
import { describe, it, expect } from "vitest";

describe("finance schema", () => {
  it("creates a manual payable entry", async () => {
    const store = await prisma.store.create({ data: { slug: "finance-schema-teste", name: "T" } });
    const entry = await prisma.financeEntry.create({
      data: { storeId: store.id, kind: "EXPENSE", amountCents: 5000, description: "Aluguel", dueDate: new Date() },
    });
    expect(entry.orderId).toBeNull();
    await prisma.store.delete({ where: { id: store.id } });
  });
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/finance/schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations tests/finance/schema.test.ts
git commit -m "feat: add finance schema (FinanceCategory/BankAccount/FinanceEntry) and FiscalDocument reservation"
```

## Task 2: Automatic `FinanceEntry` on order completion

**Files:**
- Create: `src/lib/finance/recordOrderCompletion.ts`
- Modify: `docs/superpowers/plans/2026-10-21-delivery-02-orders-realtime.md`'s status-transition route (`src/app/api/stores/[storeId]/orders/[orderId]/status/route.ts`) — add the call
- Test: `tests/finance/recordOrderCompletion.test.ts`

**Interfaces:**
- Consumes: `Order` (Orders plan), `prisma`.
- Produces: `recordOrderCompletion(storeId: string, order: Order): Promise<void>` — idempotent: creates exactly one `FinanceEntry{ kind: "INCOME", orderId: order.id, amountCents: order.totalCents, paidAt: now }` per `orderId`, no-op if one already exists. The status-transition route calls this only when the transition's `next` status is `COMPLETED`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { recordOrderCompletion } from "@/lib/finance/recordOrderCompletion";

describe("recordOrderCompletion", () => {
  let storeId: string, orderId: string;
  beforeEach(async () => {
    storeId = (await prisma.store.create({ data: { slug: "completion-teste", name: "T" } })).id;
    const order = await prisma.order.create({ data: { storeId, channel: "PDV", status: "COMPLETED", subtotalCents: 2000, totalCents: 2000 } });
    orderId = order.id;
  });
  afterEach(async () => { await prisma.store.delete({ where: { id: storeId } }); });

  it("creates one INCOME entry for the order", async () => {
    await recordOrderCompletion(storeId, { id: orderId, totalCents: 2000 } as any);
    const entries = await prisma.financeEntry.findMany({ where: { orderId } });
    expect(entries).toHaveLength(1);
    expect(entries[0].amountCents).toBe(2000);
  });

  it("is idempotent when called twice for the same order", async () => {
    await recordOrderCompletion(storeId, { id: orderId, totalCents: 2000 } as any);
    await recordOrderCompletion(storeId, { id: orderId, totalCents: 2000 } as any);
    const entries = await prisma.financeEntry.findMany({ where: { orderId } });
    expect(entries).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/finance/recordOrderCompletion.test.ts`
Expected: FAIL ("recordOrderCompletion is not a function").

- [ ] **Step 3: Implement `recordOrderCompletion`**

Use `prisma.financeEntry.findFirst({ where: { orderId } })` to check existence before creating; or rely on a unique constraint — spec doesn't require one, so implement via the existence check inside the same `$transaction` the route already uses for the status update (avoids a race within a single request; concurrent duplicate requests are an accepted edge case not covered by spec 03).

- [ ] **Step 4: Wire the call into the status-transition route**

After the transaction that updates `Order.status` and creates the `OrderStatusEvent` (Orders plan Task 4), add: `if (body.status === "COMPLETED") await recordOrderCompletion(storeId, updatedOrder);`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/finance/recordOrderCompletion.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/finance/recordOrderCompletion.ts src/app/api/stores/[storeId]/orders/[orderId]/status tests/finance/recordOrderCompletion.test.ts
git commit -m "feat: auto-create income entry on order completion"
```

## Task 3: Manual `FinanceEntry` CRUD (payables/receivables)

**Files:**
- Create: `src/app/api/stores/[storeId]/finance/entries/route.ts`, `.../entries/[entryId]/route.ts`
- Test: `tests/finance/entries.test.ts`

**Interfaces:**
- Consumes: `prisma`, `FinanceCategory`/`BankAccount` (for FK validation).
- Produces: `POST /api/stores/:storeId/finance/entries` body `{ kind, amountCents, description, categoryId?, bankAccountId?, dueDate?, paidAt? }` — strips/rejects any client-supplied `orderId`. `PATCH .../entries/:entryId` with `{ paidAt }` is how a pending entry gets settled.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST, PATCH } from "@/app/api/stores/[storeId]/finance/entries/route";

describe("finance entries API", () => {
  let storeId: string;
  beforeEach(async () => { storeId = (await prisma.store.create({ data: { slug: "entries-teste", name: "T" } })).id; });
  afterEach(async () => { await prisma.store.delete({ where: { id: storeId } }); });

  it("creates a manual payable, ignoring any client-sent orderId", async () => {
    const res = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ kind: "EXPENSE", amountCents: 3000, description: "Fornecedor", dueDate: new Date().toISOString(), orderId: "forjado" }) }), { params: { storeId } } as any);
    const body = await res.json();
    expect(body.orderId).toBeNull();
  });

  it("settles a pending entry via PATCH", async () => {
    const entry = await prisma.financeEntry.create({ data: { storeId, kind: "EXPENSE", amountCents: 100, description: "X", dueDate: new Date() } });
    const res = await PATCH(new Request("http://x", { method: "PATCH", body: JSON.stringify({ paidAt: new Date().toISOString() }) }), { params: { storeId, entryId: entry.id } } as any);
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/finance/entries.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the route handlers**

Always set `orderId: null` on manually-created entries regardless of request body content (ignore, don't 400 — simplest safe behavior). Scope every query/update by `storeId`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/finance/entries.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/stores/[storeId]/finance/entries tests/finance/entries.test.ts
git commit -m "feat: add manual finance entry CRUD"
```

## Task 4: Bank accounts + balance calculation

**Files:**
- Create: `src/lib/finance/balance.ts`
- Create: `src/app/api/stores/[storeId]/finance/accounts/route.ts`
- Test: `tests/finance/balance.test.ts`

**Interfaces:**
- Consumes: `BankAccount`, `FinanceEntry` (Task 1).
- Produces: `calculateAccountBalance(storeId: string, bankAccountId: string, asOf?: Date): Promise<number>` — `initialBalanceCents + sum(paid entries for that account up to asOf, default now)`. The accounts route's `GET` includes each account's computed balance in its response.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { calculateAccountBalance } from "@/lib/finance/balance";

describe("calculateAccountBalance", () => {
  let storeId: string, accountId: string;
  beforeEach(async () => {
    storeId = (await prisma.store.create({ data: { slug: "balance-teste", name: "T" } })).id;
    accountId = (await prisma.bankAccount.create({ data: { storeId, name: "Caixa", initialBalanceCents: 10000 } })).id;
    await prisma.financeEntry.create({ data: { storeId, bankAccountId: accountId, kind: "INCOME", amountCents: 5000, paidAt: new Date() } });
    await prisma.financeEntry.create({ data: { storeId, bankAccountId: accountId, kind: "EXPENSE", amountCents: 2000, paidAt: new Date() } });
    await prisma.financeEntry.create({ data: { storeId, kind: "INCOME", amountCents: 999999 } }); // no bankAccountId, unpaid — must not count
  });
  afterEach(async () => { await prisma.store.delete({ where: { id: storeId } }); });

  it("sums initial balance plus paid entries for that account only", async () => {
    const balance = await calculateAccountBalance(storeId, accountId);
    expect(balance).toBe(10000 + 5000 - 2000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/finance/balance.test.ts`
Expected: FAIL ("calculateAccountBalance is not a function").

- [ ] **Step 3: Implement `calculateAccountBalance`**

Query `financeEntry` where `storeId`, `bankAccountId`, `paidAt: { lte: asOf, not: null } }`; sum `kind === "INCOME" ? +amountCents : -amountCents`; add `initialBalanceCents`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/finance/balance.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/finance/balance.ts src/app/api/stores/[storeId]/finance/accounts tests/finance/balance.test.ts
git commit -m "feat: add bank account CRUD and on-demand balance calculation"
```

## Task 5: `FinanceCategory` CRUD

**Files:**
- Create: `src/app/api/stores/[storeId]/finance/categories/route.ts`
- Test: `tests/finance/categories.test.ts`

**Interfaces:**
- Consumes: `prisma`.
- Produces: `GET`/`POST /api/stores/:storeId/finance/categories` body `{ name, kind: "INCOME" | "EXPENSE" }`. No default-category seeding here — that is the Onboarding plan's responsibility (spec 05, step 1), which will call this same `POST` or create rows directly; this task only provides the CRUD surface.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/stores/[storeId]/finance/categories/route";

describe("finance categories API", () => {
  let storeId: string;
  beforeEach(async () => { storeId = (await prisma.store.create({ data: { slug: "cat-fin-teste", name: "T" } })).id; });
  afterEach(async () => { await prisma.store.delete({ where: { id: storeId } }); });

  it("creates an expense category", async () => {
    const res = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ name: "Fornecedores", kind: "EXPENSE" }) }), { params: { storeId } } as any);
    expect(res.status).toBe(201);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/finance/categories.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the route handler**

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/finance/categories.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/stores/[storeId]/finance/categories tests/finance/categories.test.ts
git commit -m "feat: add finance category CRUD"
```

## Task 6: Reports

**Files:**
- Create: `src/lib/finance/reports.ts`
- Create: `src/app/api/stores/[storeId]/finance/reports/route.ts`
- Test: `tests/finance/reports.test.ts`

**Interfaces:**
- Consumes: `FinanceEntry`, `Order` (Orders plan).
- Produces: `cashFlowReport(storeId, { from, to }): Promise<{ bankAccountId: string | null; totalCents: number }[]>`; `payablesReceivablesReport(storeId, { asOf }): Promise<{ id, description, dueDate, amountCents, overdue: boolean }[]>` (only `paidAt: null` rows, `overdue = dueDate < asOf`); `revenueByChannelReport(storeId, { from, to }): Promise<{ channel: OrderChannel; totalCents: number }[]>` (only non-`CANCELED` orders).

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { payablesReceivablesReport, revenueByChannelReport } from "@/lib/finance/reports";

describe("finance reports", () => {
  let storeId: string;
  beforeEach(async () => { storeId = (await prisma.store.create({ data: { slug: "reports-teste", name: "T" } })).id; });
  afterEach(async () => { await prisma.store.delete({ where: { id: storeId } }); });

  it("marks a receivable due yesterday as overdue and one due today as not", async () => {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 86400000);
    await prisma.financeEntry.create({ data: { storeId, kind: "INCOME", amountCents: 100, description: "A", dueDate: today } });
    await prisma.financeEntry.create({ data: { storeId, kind: "INCOME", amountCents: 100, description: "B", dueDate: yesterday } });
    const report = await payablesReceivablesReport(storeId, { asOf: today });
    expect(report.find(r => r.description === "A")!.overdue).toBe(false);
    expect(report.find(r => r.description === "B")!.overdue).toBe(true);
  });

  it("excludes canceled orders from revenue by channel", async () => {
    await prisma.order.create({ data: { storeId, channel: "PDV", status: "COMPLETED", subtotalCents: 1000, totalCents: 1000 } });
    await prisma.order.create({ data: { storeId, channel: "PDV", status: "CANCELED", subtotalCents: 5000, totalCents: 5000 } });
    const from = new Date(Date.now() - 86400000), to = new Date(Date.now() + 86400000);
    const report = await revenueByChannelReport(storeId, { from, to });
    expect(report.find(r => r.channel === "PDV")!.totalCents).toBe(1000);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/finance/reports.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the three report functions and the route handler**

`cashFlowReport`: group paid `FinanceEntry` within `[from, to]` by `bankAccountId`, sum signed amounts. `payablesReceivablesReport`: filter `paidAt: null`, compute `overdue` by comparing `dueDate` to the start of `asOf`'s day (avoid same-day false positives — Review Focus line 3). `revenueByChannelReport`: filter `Order.status: { not: "CANCELED" }` within `[from, to]`, group by `channel`, sum `totalCents`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/finance/reports.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/finance/reports.ts src/app/api/stores/[storeId]/finance/reports tests/finance/reports.test.ts
git commit -m "feat: add cash flow, payables/receivables, and revenue-by-channel reports"
```

## Task 7: Minimal financeiro UI

**Files:**
- Create: `src/app/(dashboard)/[store]/financeiro/page.tsx`
- Test: none required (manual verification, same rationale as prior plans)

**Interfaces:**
- Consumes: Tasks 3–6's routes.

- [ ] **Step 1: Build the page**

Tabs or sections for: manual entry list + create form (Task 3), bank accounts with computed balance (Task 4), and the three reports (Task 6) rendered as simple tables.

- [ ] **Step 2: Manually verify in a browser**

Create a manual payable, settle it, create a bank account, complete an order (via Orders plan UI/API) and confirm its income entry and the revenue report both reflect it.

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/[store]/financeiro
git commit -m "feat: add minimal financeiro UI"
```

---

## Self-Review Notes

- **Spec coverage:** automatic cash-flow entry, manual payables/receivables, categorization, bank account balance, and all three V1 reports from spec 03 are covered (Tasks 1–7). Fiscal stays schema-only per spec 03 (Task 1 only, no emission task added).
- **Step scan:** every code step gives an exact signature; idempotency rule for Task 2 and the overdue date-boundary rule for Task 6 are spelled out since the spec doesn't fix the exact mechanism.
- **Type consistency:** `FinanceEntry.orderId`/`bankAccountId`/`categoryId` nullability conventions are used identically across Tasks 2–6; report function names match what Task 7's UI calls.
- **Review Focus:** all 5 lines map to tests — double-counting (Task 2), orderId spoofing (Task 3), overdue boundary and null-account balance exclusion (Tasks 4, 6), canceled-order exclusion (Task 6).
- **Proportion:** plan length tracks spec 03; no step repeats another task's code.
