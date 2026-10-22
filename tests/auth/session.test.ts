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
