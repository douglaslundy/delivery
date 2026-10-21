# Delivery Platform — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the project skeleton — Next 16 app, Prisma 6/Postgres schema for `Store`/auth, subdomain-based multi-tenant resolution, next-auth v4 session, and the shared AES-256-GCM credentials helper — so every later subsystem plan (menu, orders, finance, marketing/atendimento/entregas, onboarding/infra) builds on a working, tested base.

**Architecture:** App Router Next 16 project, Prisma 6 against Postgres, next-auth v4 credentials provider. A tenant-resolution layer reads the request's subdomain and attaches `storeId` to every authenticated session; all later schema (menu, orders, etc.) will carry `storeId` and follow the `(storeId, id)` composite-FK pattern fixed here.

**Tech Stack:** Next 16 (App Router, TypeScript), Prisma 6, PostgreSQL, next-auth v4, Node crypto (AES-256-GCM), npm.

**Spec:** `docs/superpowers/specs/2026-10-21-delivery-design-00-overview.md` and `2026-10-21-delivery-design-01-domain-model.md` (section "Multi-tenant e auth") — executors read both.

## Global Constraints

- Independent project: never share repo, database, container, or deploy with `ecomerce` (spec 00, Anti-goals).
- Every business table carries `storeId`; cross-table FKs inside a store use the composite `(storeId, id)` pattern (spec 01).
- Credentials (any provider: Evolution, Mercado Pago, etc.) are encrypted at rest with the same `CREDENTIALS_KEY` AES-256-GCM pattern used in `ecomerce` — never stored plaintext (spec 00, 05).
- No Docker available in the local Windows dev environment (spec 00, Constraints) — dev and automated tests run against a dedicated Postgres database reachable over the network (see Task 1 builder call), never against another project's database/container.
- Nothing in this plan touches Evolution API, Mercado Pago, fiscal, or WebSocket code — those are later subsystem plans.

## Review Focus

- **Cross-tenant data leak via session mismatch:** a user authenticated for store A must never receive a session/cookie that resolves to store B's `storeId` — test: login as a `StoreMember` of store A, confirm session `storeId` matches A even when a second store B exists with overlapping data.
- **Subdomain spoofing:** a request claiming a subdomain the caller has no membership for must not grant access — test: authenticated user of store A requests the app under store B's subdomain, expect 403/redirect, not silent access.
- **Credential encryption round-trip corruption:** encrypting then decrypting a credential string must return the exact original value, including edge cases (empty string, unicode) — test: round-trip assertions for the crypto helper.
- **Multi-store user without an active selection:** a user belonging to more than one store must be forced to pick one before any `storeId`-scoped request succeeds — test: multi-store user hits a protected route pre-selection, expect redirect to store picker, not a crash or default-to-first-store leak.
- **Inactive store still reachable:** a `Store.active = false` tenant must not authenticate/serve requests — test: login attempt against an inactive store's subdomain is rejected.

---

## File Structure

- `package.json`, `tsconfig.json`, `next.config.ts` — project root.
- `prisma/schema.prisma` — `Store`, `StoreDomain`, `Account`, `StoreMember` models (this plan only; later plans append their own models to the same file).
- `src/lib/prisma.ts` — singleton Prisma client.
- `src/lib/crypto.ts` — `encryptCredential`/`decryptCredential` AES-256-GCM helpers.
- `src/lib/tenant.ts` — subdomain → `storeId` resolution.
- `src/auth.ts` — next-auth v4 config (credentials provider, session callback injecting `storeId`).
- `src/middleware.ts` — Next middleware wiring tenant resolution + auth guard.
- `tests/lib/crypto.test.ts`, `tests/lib/tenant.test.ts`, `tests/auth/session.test.ts` — test files per task.

## Task 1: Project scaffold + Postgres connection

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `.env.example`, `.gitignore`
- Create: `prisma/schema.prisma` (datasource + generator block only, no models yet)

**Interfaces:**
- Produces: `DATABASE_URL` env var convention (`postgresql://user:pass@host:port/db?schema=public`), `prisma/schema.prisma` ready for `Store` models in Task 2.

- [ ] **Step 1: Builder call — confirm dev database target**

No local Docker (spec 00, Constraints). Use a dedicated Postgres database/schema reachable over the network for dev + automated tests — e.g. a `delivery_dev` database on the test VPS (`192.168.0.233`) or any Postgres instance the implementer has credentials for — **never** the `ecomerce` database/container. Record the actual choice made in the PR description (spec 00 requires this, not silent assumption).

- [ ] **Step 2: Scaffold Next 16 app**

Run: `npx create-next-app@latest . --typescript --app --no-tailwind --eslint --src-dir --import-alias "@/*"` (answer "no" to any prompt that would overwrite an existing `docs/` directory).
Expected: `package.json`, `tsconfig.json`, `next.config.ts`, `src/app/` created; `docs/` untouched.

- [ ] **Step 3: Install Prisma, next-auth v4, and test runner**

Run: `npm install prisma @prisma/client next-auth@4` and `npm install -D vitest @vitest/coverage-v8 tsx`
Expected: dependencies added to `package.json`.

- [ ] **Step 4: Initialize Prisma datasource**

Run: `npx prisma init --datasource-provider postgresql`
Edit `.env.example` to document `DATABASE_URL` and `CREDENTIALS_KEY` (32-byte hex/base64 key for AES-256-GCM) without real values.

- [ ] **Step 5: Add `npm test` script**

In `package.json` `scripts`: `"test": "vitest run"`.

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.json next.config.ts .env.example .gitignore prisma/schema.prisma
git commit -m "chore: scaffold Next 16 + Prisma 6 + next-auth v4 project"
```

## Task 2: `Store`/auth schema + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Test: `tests/db/schema.test.ts`

**Interfaces:**
- Consumes: Prisma client from Task 1 (`prisma/schema.prisma` datasource block).
- Produces: `Store { id, slug, name, active, timezone, currency, createdAt }`, `StoreDomain { id, storeId, domain }`, `Account { id, email, passwordHash, createdAt }`, `StoreMember { id, accountId, storeId, role }` with `role` enum `OWNER | MANAGER | ATTENDANT | KITCHEN | DELIVERY` (spec 01) — every later model's `storeId` FK points at `Store.id`.

- [ ] **Step 1: Write the schema**

```prisma
model Store {
  id        String   @id @default(cuid())
  slug      String   @unique
  name      String
  active    Boolean  @default(true)
  timezone  String   @default("America/Sao_Paulo")
  currency  String   @default("BRL")
  createdAt DateTime @default(now())

  domains   StoreDomain[]
  members   StoreMember[]
}

model StoreDomain {
  id      String @id @default(cuid())
  storeId String
  domain  String @unique

  store   Store  @relation(fields: [storeId], references: [id], onDelete: Cascade)

  @@index([storeId])
}

model Account {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())

  memberships  StoreMember[]
}

enum StoreRole {
  OWNER
  MANAGER
  ATTENDANT
  KITCHEN
  DELIVERY
}

model StoreMember {
  id        String    @id @default(cuid())
  accountId String
  storeId   String
  role      StoreRole

  account   Account   @relation(fields: [accountId], references: [id], onDelete: Cascade)
  store     Store     @relation(fields: [storeId], references: [id], onDelete: Cascade)

  @@unique([accountId, storeId])
  @@index([storeId])
}
```

- [ ] **Step 2: Generate and run the migration**

Run: `npx prisma migrate dev --name init_store_auth`
Expected: migration folder created under `prisma/migrations/`, applied against the dev database chosen in Task 1 Step 1, exits 0.

- [ ] **Step 3: Write a schema smoke test**

```ts
import { prisma } from "@/lib/prisma";
import { describe, it, expect, afterAll } from "vitest";

describe("Store schema", () => {
  it("creates a store with a unique slug", async () => {
    const store = await prisma.store.create({ data: { slug: "padaria-teste", name: "Padaria Teste" } });
    expect(store.active).toBe(true);
    await prisma.store.delete({ where: { id: store.id } });
  });
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/db/schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations tests/db/schema.test.ts
git commit -m "feat: add Store/Account/StoreMember schema and migration"
```

## Task 3: Prisma client singleton

**Files:**
- Create: `src/lib/prisma.ts`

**Interfaces:**
- Produces: `export const prisma: PrismaClient` — every later task imports this, never instantiates its own client.

- [ ] **Step 1: Implement the singleton**

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/prisma.ts
git commit -m "feat: add Prisma client singleton"
```

## Task 4: Credentials encryption helper

**Files:**
- Create: `src/lib/crypto.ts`
- Test: `tests/lib/crypto.test.ts`

**Interfaces:**
- Consumes: `process.env.CREDENTIALS_KEY` (32-byte key, base64-encoded).
- Produces: `encryptCredential(plaintext: string): string` and `decryptCredential(ciphertext: string): string` — later plans (Evolution API, Mercado Pago) call these to store/read tenant credentials, never writing plaintext to the database.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { encryptCredential, decryptCredential } from "@/lib/crypto";

describe("credential encryption", () => {
  it("round-trips a plaintext string", () => {
    const original = "evolution-api-key-abc123";
    const encrypted = encryptCredential(original);
    expect(encrypted).not.toBe(original);
    expect(decryptCredential(encrypted)).toBe(original);
  });

  it("round-trips an empty string", () => {
    const encrypted = encryptCredential("");
    expect(decryptCredential(encrypted)).toBe("");
  });

  it("round-trips unicode content", () => {
    const original = "chave-çãú-123";
    expect(decryptCredential(encryptCredential(original))).toBe(original);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/lib/crypto.test.ts`
Expected: FAIL with "encryptCredential is not a function" (module doesn't exist yet).

- [ ] **Step 3: Implement `encryptCredential`/`decryptCredential` in `src/lib/crypto.ts`**

Use Node's `crypto` module, AES-256-GCM, a random 12-byte IV per call, and pack `iv:authTag:ciphertext` (each base64) into the single returned string so `decryptCredential` can split and verify without extra storage columns — same approach as the `ecomerce` pattern this plan reuses (spec 00).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/lib/crypto.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/crypto.ts tests/lib/crypto.test.ts
git commit -m "feat: add AES-256-GCM credential encryption helper"
```

## Task 5: Subdomain → `storeId` resolution

**Files:**
- Create: `src/lib/tenant.ts`
- Test: `tests/lib/tenant.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 3), request `Host` header.
- Produces: `resolveStoreBySubdomain(host: string): Promise<Store | null>` — returns `null` for unknown or inactive stores. The middleware (Task 7) and every tenant-scoped API route call this (or its cached session equivalent) to get `storeId`; no route trusts a client-supplied `storeId`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resolveStoreBySubdomain } from "@/lib/tenant";

describe("resolveStoreBySubdomain", () => {
  beforeAll(async () => {
    await prisma.store.create({ data: { slug: "ativa", name: "Loja Ativa" } });
    await prisma.store.create({ data: { slug: "inativa", name: "Loja Inativa", active: false } });
  });
  afterAll(async () => {
    await prisma.store.deleteMany({ where: { slug: { in: ["ativa", "inativa"] } } });
  });

  it("resolves an active store from its subdomain", async () => {
    const store = await resolveStoreBySubdomain("ativa.dominio.com");
    expect(store?.slug).toBe("ativa");
  });

  it("returns null for an inactive store", async () => {
    const store = await resolveStoreBySubdomain("inativa.dominio.com");
    expect(store).toBeNull();
  });

  it("returns null for an unknown subdomain", async () => {
    const store = await resolveStoreBySubdomain("nao-existe.dominio.com");
    expect(store).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/lib/tenant.test.ts`
Expected: FAIL with "resolveStoreBySubdomain is not a function".

- [ ] **Step 3: Implement `resolveStoreBySubdomain` in `src/lib/tenant.ts`**

Parse the leftmost label of `host` as the slug (strip port), query `prisma.store.findUnique({ where: { slug } })`, return `null` when not found or `active === false`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/lib/tenant.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/tenant.ts tests/lib/tenant.test.ts
git commit -m "feat: add subdomain to store resolution"
```

## Task 6: next-auth v4 session with `storeId`

**Files:**
- Create: `src/auth.ts`
- Modify: `prisma/schema.prisma` (no new models; this task only configures next-auth, which here uses the credentials provider against `Account`/`StoreMember` directly rather than the next-auth Prisma adapter tables)
- Test: `tests/auth/session.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 3), `Account`/`StoreMember` (Task 2).
- Produces: next-auth `authOptions` whose `session` callback exposes `session.storeId: string | null` and `session.availableStoreIds: string[]` — `storeId` is set only when the account has exactly one `StoreMember`; otherwise `null` until the store-picker flow (Task 8, next subsystem plan) sets it. Later API routes read `session.storeId`, never accept one from the request body.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/auth";
import bcrypt from "bcryptjs";

describe("session callback", () => {
  let accountId: string;
  let storeId: string;

  beforeAll(async () => {
    const store = await prisma.store.create({ data: { slug: "sessao-teste", name: "Sessao Teste" } });
    storeId = store.id;
    const account = await prisma.account.create({
      data: { email: "dono@teste.com", passwordHash: await bcrypt.hash("senha123", 10) },
    });
    accountId = account.id;
    await prisma.storeMember.create({ data: { accountId, storeId, role: "OWNER" } });
  });
  afterAll(async () => {
    await prisma.storeMember.deleteMany({ where: { accountId } });
    await prisma.account.delete({ where: { id: accountId } });
    await prisma.store.delete({ where: { id: storeId } });
  });

  it("sets session.storeId when the account has exactly one membership", async () => {
    const token = { sub: accountId };
    const session = await authOptions.callbacks!.session!({ session: { user: {} } as any, token } as any);
    expect((session as any).storeId).toBe(storeId);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/auth/session.test.ts`
Expected: FAIL (module `@/auth` doesn't exist).

- [ ] **Step 3: Implement `authOptions` in `src/auth.ts`**

Credentials provider: `authorize({ email, password })` looks up `Account` by email, verifies `passwordHash` with `bcryptjs.compare`, returns `{ id: account.id }` or `null`. `session` callback: load `StoreMember` rows for `token.sub`; if exactly one, set `session.storeId` to it; otherwise `session.storeId = null` and `session.availableStoreIds` to the full list.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/auth/session.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/auth.ts tests/auth/session.test.ts
git commit -m "feat: add next-auth v4 session with storeId resolution"
```

## Task 7: Middleware — subdomain/session guard

**Files:**
- Create: `src/middleware.ts`
- Test: `tests/middleware/guard.test.ts`

**Interfaces:**
- Consumes: `resolveStoreBySubdomain` (Task 5), next-auth session (Task 6).
- Produces: a Next middleware that (a) resolves the request's `Store` from its subdomain and 404s when none is found/active, (b) for authenticated routes, rejects with 403 when the session's authorized stores don't include the resolved store's id. This is the single enforcement point later route handlers rely on — no route re-implements tenant checking.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { evaluateTenantGuard } from "@/middleware";

describe("evaluateTenantGuard", () => {
  it("allows a request when the session's store matches the subdomain's store", () => {
    const result = evaluateTenantGuard({ resolvedStoreId: "store-a", sessionStoreIds: ["store-a"] });
    expect(result.allowed).toBe(true);
  });

  it("blocks a request when the session belongs to a different store", () => {
    const result = evaluateTenantGuard({ resolvedStoreId: "store-b", sessionStoreIds: ["store-a"] });
    expect(result.allowed).toBe(false);
  });

  it("blocks when there is no resolved store (unknown/inactive subdomain)", () => {
    const result = evaluateTenantGuard({ resolvedStoreId: null, sessionStoreIds: ["store-a"] });
    expect(result.allowed).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/middleware/guard.test.ts`
Expected: FAIL ("evaluateTenantGuard is not a function").

- [ ] **Step 3: Implement `evaluateTenantGuard` and the Next `middleware` export in `src/middleware.ts`**

`evaluateTenantGuard({ resolvedStoreId, sessionStoreIds }): { allowed: boolean }` is the pure, directly testable core: `allowed = resolvedStoreId !== null && sessionStoreIds.includes(resolvedStoreId)`. The exported `middleware(request)` function wires it to the real `Host` header via `resolveStoreBySubdomain` and the next-auth JWT, returning a 404 response when `resolvedStoreId` is null and a 403 when the guard disallows; both paths leave public routes (login, onboarding step 1) unaffected per `config.matcher`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/middleware/guard.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/middleware.ts tests/middleware/guard.test.ts
git commit -m "feat: add tenant-resolution and session guard middleware"
```

## Task 8: Multi-store picker gate (no active `storeId`)

**Files:**
- Test: `tests/lib/tenant.test.ts` (extend) or `tests/auth/session.test.ts` (extend) — whichever file already covers the related case; add, don't duplicate.

**Interfaces:**
- Consumes: `session.storeId`/`session.availableStoreIds` (Task 6).
- Produces: `requiresStoreSelection(session): boolean` — `true` when `session.storeId === null && session.availableStoreIds.length > 1`. UI/route code (future plans) calls this to redirect to a store picker instead of guessing a default store.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { requiresStoreSelection } from "@/auth";

describe("requiresStoreSelection", () => {
  it("is true when storeId is null and there are multiple stores", () => {
    expect(requiresStoreSelection({ storeId: null, availableStoreIds: ["a", "b"] } as any)).toBe(true);
  });
  it("is false when storeId is already set", () => {
    expect(requiresStoreSelection({ storeId: "a", availableStoreIds: ["a", "b"] } as any)).toBe(false);
  });
  it("is false when the account has zero stores (handled as access-denied elsewhere, not a picker)", () => {
    expect(requiresStoreSelection({ storeId: null, availableStoreIds: [] } as any)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/auth/session.test.ts`
Expected: FAIL ("requiresStoreSelection is not a function").

- [ ] **Step 3: Implement `requiresStoreSelection` in `src/auth.ts`**

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/auth/session.test.ts`
Expected: PASS (all tests in file, including the 3 new ones).

- [ ] **Step 5: Commit**

```bash
git add src/auth.ts tests/auth/session.test.ts
git commit -m "feat: add multi-store selection gate"
```

---

## Self-Review Notes

- **Spec coverage:** Multi-tenant/auth section of spec 01 fully covered (Store/StoreDomain/Account/StoreMember, role enum, subdomain resolution, composite-FK convention documented as a constraint for later plans). Menu/orders/finance/marketing/onboarding are explicitly out of scope — separate plans (see handoff note below).
- **Step scan:** every code step names an exact signature; bodies are left to the implementer except where the spec fixes an algorithm (AES-256-GCM packing in Task 4, slug parsing in Task 5) or Prisma schema fields the spec pins (Task 2).
- **Type consistency:** `storeId` is `String` (cuid) everywhere; `StoreRole` enum values match spec 01 exactly; `session.storeId`/`session.availableStoreIds` names are fixed in Task 6 and reused unchanged in Tasks 7–8.
- **Review Focus:** all 5 lines above map to a task's tests (Tasks 2, 5, 6, 7, 8).
- **Proportion:** plan is comparable in length to the relevant spec section; no step repeats code another task's Interfaces block already describes.
