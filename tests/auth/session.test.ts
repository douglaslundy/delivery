import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { authOptions, requiresStoreSelection } from "@/auth";
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
