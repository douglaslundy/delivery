import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";

const session = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("next-auth", () => ({ getServerSession: async () => session.value }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

import { isPlatformAdmin, requirePlatformAdmin } from "@/lib/admin/guard";
import { GET as listStores, POST as createStore } from "@/app/api/admin/stores/route";
import { DELETE as deleteStore } from "@/app/api/admin/stores/[id]/route";
import { DELETE as deletePlan } from "@/app/api/admin/plans/[id]/route";

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const post = (body: unknown) => new Request("http://x", { method: "POST", body: JSON.stringify(body) });

describe("platform admin guard and store deletion", () => {
  const cleanupSlugs = ["admin-teste-loja"];
  const cleanupEmails = ["dono-admin-teste@test.com"];
  let planId: string | undefined;

  beforeEach(() => {
    session.value = { isPlatformAdmin: true };
  });
  afterAll(async () => {
    await prisma.store.deleteMany({ where: { slug: { in: cleanupSlugs } } });
    await prisma.account.deleteMany({ where: { email: { in: cleanupEmails } } });
    if (planId) await prisma.plan.deleteMany({ where: { id: planId } });
  });

  it("isPlatformAdmin reflects the session flag", async () => {
    expect(await isPlatformAdmin()).toBe(true);
    session.value = { isPlatformAdmin: false };
    expect(await isPlatformAdmin()).toBe(false);
    session.value = null;
    expect(await isPlatformAdmin()).toBe(false);
  });

  it("requirePlatformAdmin redirects non-admins to /login", async () => {
    session.value = { isPlatformAdmin: false };
    await expect(requirePlatformAdmin()).rejects.toThrow("REDIRECT:/login");
    session.value = { isPlatformAdmin: true };
    await expect(requirePlatformAdmin()).resolves.toBeUndefined();
  });

  it("admin API answers 403 to non-admins", async () => {
    session.value = { isPlatformAdmin: false };
    expect((await listStores()).status).toBe(403);
    expect((await createStore(post({}))).status).toBe(403);
    expect((await deleteStore(new Request("http://x"), ctx("x"))).status).toBe(403);
  });

  it("creates a store with an owner, then deletes it with all its data", async () => {
    const res = await createStore(
      post({ name: "Admin Teste", slug: "admin-teste-loja", ownerEmail: "dono-admin-teste@test.com", ownerPassword: "senha12345" }),
    );
    expect(res.status).toBe(201);
    const { id } = await res.json();

    await prisma.category.create({ data: { storeId: id, name: "Cat" } });
    await prisma.customer.create({ data: { storeId: id, name: "Cli", phone: "5511" } });
    await prisma.order.create({ data: { storeId: id, channel: "PDV", subtotalCents: 1, totalCents: 1 } });

    expect((await deleteStore(new Request("http://x"), ctx(id))).status).toBe(204);
    expect(await prisma.store.findUnique({ where: { id } })).toBeNull();
    expect(await prisma.order.count({ where: { storeId: id } })).toBe(0);
    expect(await prisma.customer.count({ where: { storeId: id } })).toBe(0);
    expect((await deleteStore(new Request("http://x"), ctx(id))).status).toBe(404);
  });

  it("refuses to delete a plan that stores still use", async () => {
    const plan = await prisma.plan.create({ data: { name: "Em uso", priceCents: 1 } });
    planId = plan.id;
    const store = await prisma.store.create({ data: { slug: "admin-teste-loja", name: "X", planId } });

    const res = await deletePlan(new Request("http://x"), ctx(plan.id));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/em uso/i);

    await prisma.store.delete({ where: { id: store.id } });
    expect((await deletePlan(new Request("http://x"), ctx(plan.id))).status).toBe(204);
    planId = undefined;
  });
});
