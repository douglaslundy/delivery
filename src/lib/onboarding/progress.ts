import type { Store, StoreOnboardingProgress } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type OnboardingStepKey =
  | "step1EstablishmentDone"
  | "step2PaymentDone"
  | "step3HoursDone"
  | "step4DeliveryAreaDone"
  | "step5BotDone"
  | "step6DeliveryTimeDone"
  | "step7SalaoStructureDone"
  | "step8ReviewDone";

export async function createStoreWithOnboarding(input: {
  slug: string;
  name: string;
  foodCategory?: string;
}): Promise<{ store: Store; progress: StoreOnboardingProgress }> {
  return prisma.$transaction(async (tx) => {
    const store = await tx.store.create({
      data: { slug: input.slug, name: input.name, foodCategory: input.foodCategory },
    });

    const progress = await tx.storeOnboardingProgress.create({
      data: { storeId: store.id, step1EstablishmentDone: true },
    });

    return { store, progress };
  });
}

export async function completeReview(storeId: string): Promise<void> {
  const progress = await prisma.storeOnboardingProgress.findUniqueOrThrow({ where: { storeId } });
  if (!progress.step1EstablishmentDone) {
    throw new Error("step 1 (establishment) must be done before completing the review");
  }

  await prisma.storeOnboardingProgress.update({
    where: { storeId },
    data: { step8ReviewDone: true, completedAt: new Date() },
  });
}

export function canAccessDashboard(progress: StoreOnboardingProgress): boolean {
  return progress.step1EstablishmentDone;
}

export async function markStepDone(storeId: string, step: OnboardingStepKey): Promise<void> {
  // upsert (not update) so a store with no progress row yet (e.g. created
  // before onboarding tracking existed, or in a test that creates a bare
  // Store directly) gets one instead of silently losing the step completion.
  // Step 1 is true by definition once the store exists.
  await prisma.storeOnboardingProgress.upsert({
    where: { storeId },
    create: { storeId, step1EstablishmentDone: true, [step]: true },
    update: { [step]: true },
  });
}
