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
