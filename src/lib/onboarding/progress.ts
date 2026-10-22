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

export async function markStepDone(storeId: string, step: OnboardingStepKey): Promise<void> {
  await prisma.storeOnboardingProgress.update({
    where: { storeId },
    data: { [step]: true },
  });
}
