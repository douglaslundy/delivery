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

  it("completeReview throws when step 1 isn't done", async () => {
    const store = await prisma.store.create({ data: { slug: "review-teste-3", name: "T" } });
    storeId = store.id;
    await prisma.storeOnboardingProgress.create({ data: { storeId, step1EstablishmentDone: false } });
    await expect(completeReview(storeId)).rejects.toThrow();
  });
});
