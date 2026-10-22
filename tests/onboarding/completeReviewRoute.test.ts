import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createStoreWithOnboarding } from "@/lib/onboarding/progress";
import { POST } from "@/app/api/stores/[storeId]/onboarding/complete-review/route";

describe("complete-review route", () => {
  let storeId: string;
  afterEach(async () => {
    await prisma.store.delete({ where: { id: storeId } });
    await prisma.account.deleteMany({ where: { email: { startsWith: "owner-complete-review-teste" } } });
  });

  function hostFor(slug: string) {
    return { headers: { host: `${slug}.dominio.com` } };
  }

  it("completes the review via the route", async () => {
    const { store } = await createStoreWithOnboarding({ slug: "complete-review-teste", name: "T", ownerEmail: "owner-complete-review-teste@test.com", ownerPassword: "senha12345" });
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
