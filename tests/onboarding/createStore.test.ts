import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createStoreWithOnboarding, markStepDone } from "@/lib/onboarding/progress";

describe("createStoreWithOnboarding", () => {
  let storeId: string;
  afterEach(async () => {
    if (storeId) await prisma.store.delete({ where: { id: storeId } });
    await prisma.account.deleteMany({ where: { email: { startsWith: "owner-" } } });
  });

  it("creates a store with step 1 already marked done", async () => {
    const { store, progress } = await createStoreWithOnboarding({ slug: "nova-loja", name: "Nova Loja", foodCategory: "pizzaria", ownerEmail: "owner-nova-loja@test.com", ownerPassword: "senha12345" });
    storeId = store.id;
    expect(progress.step1EstablishmentDone).toBe(true);
    expect(progress.step2PaymentDone).toBe(false);
  });

  it("creates an Account and an OWNER StoreMember for the store owner", async () => {
    const { store, account } = await createStoreWithOnboarding({ slug: "loja-dona", name: "Loja Dona", ownerEmail: "owner-loja-dona@test.com", ownerPassword: "senha12345" });
    storeId = store.id;

    expect(account.email).toBe("owner-loja-dona@test.com");
    expect(account.passwordHash).not.toBe("senha12345");

    const member = await prisma.storeMember.findUniqueOrThrow({ where: { accountId_storeId: { accountId: account.id, storeId: store.id } } });
    expect(member.role).toBe("OWNER");

    await prisma.account.delete({ where: { id: account.id } });
  });

  it("markStepDone flips exactly the named step", async () => {
    const { store } = await createStoreWithOnboarding({ slug: "loja-mark", name: "Loja Mark", foodCategory: "lanches", ownerEmail: "owner-loja-mark@test.com", ownerPassword: "senha12345" });
    storeId = store.id;
    await markStepDone(storeId, "step3HoursDone");
    const progress = await prisma.storeOnboardingProgress.findUniqueOrThrow({ where: { storeId } });
    expect(progress.step3HoursDone).toBe(true);
    expect(progress.step4DeliveryAreaDone).toBe(false);
  });

  it("markStepDone creates a progress row instead of silently doing nothing when one is missing", async () => {
    const store = await prisma.store.create({ data: { slug: "loja-sem-progresso", name: "T" } });
    storeId = store.id;
    await markStepDone(storeId, "step4DeliveryAreaDone");
    const progress = await prisma.storeOnboardingProgress.findUniqueOrThrow({ where: { storeId } });
    expect(progress.step4DeliveryAreaDone).toBe(true);
  });
});
