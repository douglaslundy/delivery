import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createStoreWithOnboarding } from "@/lib/onboarding/progress";
import { POST } from "@/app/api/stores/[storeId]/onboarding/complete-review/route";

describe("complete-review route", () => {
  let storeId: string;
  afterEach(async () => { await prisma.store.delete({ where: { id: storeId } }); });

  function hostFor(slug: string) {
    return { headers: { host: `${slug}.dominio.com` } };
  }

  it("completes the review via the route", async () => {
    const { store } = await createStoreWithOnboarding({ slug: "complete-review-teste", name: "T" });
    storeId = store.id;
    const res = await POST(
      new Request("http://x", { method: "POST", ...hostFor("complete-review-teste") }),
      { params: Promise.resolve({ storeId }) } as any,
    );
    expect(res.status).toBe(200);
    const progress = await prisma.storeOnboardingProgress.findUniqueOrThrow({ where: { storeId } });
    expect(progress.step8ReviewDone).toBe(true);
  });
});
