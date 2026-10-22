import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/stores/route";

describe("POST /api/stores (signup)", () => {
  let storeId: string | undefined;
  let accountId: string | undefined;
  afterEach(async () => {
    if (storeId) await prisma.store.delete({ where: { id: storeId } });
    if (accountId) await prisma.account.delete({ where: { id: accountId } });
  });

  it("rejects a request without ownerEmail/ownerPassword", async () => {
    const res = await POST(
      new Request("http://x", { method: "POST", body: JSON.stringify({ slug: "sem-dono", name: "Sem Dono" }) }),
    );
    expect(res.status).toBe(400);
  });

  it("creates the store's owner Account and OWNER StoreMember", async () => {
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({
          slug: "com-dono",
          name: "Com Dono",
          ownerEmail: "owner-com-dono@test.com",
          ownerPassword: "senha12345",
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    const createdStoreId: string = body.store.id;
    storeId = createdStoreId;

    const account = await prisma.account.findUniqueOrThrow({ where: { email: "owner-com-dono@test.com" } });
    accountId = account.id;
    const member = await prisma.storeMember.findUniqueOrThrow({
      where: { accountId_storeId: { accountId: account.id, storeId: createdStoreId } },
    });
    expect(member.role).toBe("OWNER");
  });
});
