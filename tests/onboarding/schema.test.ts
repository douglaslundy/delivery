import { prisma } from "@/lib/prisma";
import { describe, it, expect } from "vitest";

describe("onboarding schema", () => {
  it("creates a progress row with all steps false by default", async () => {
    const store = await prisma.store.create({ data: { slug: "onboard-schema-teste", name: "T" } });
    const progress = await prisma.storeOnboardingProgress.create({ data: { storeId: store.id } });
    expect(progress.step1EstablishmentDone).toBe(false);
    await prisma.store.delete({ where: { id: store.id } });
  });
});
