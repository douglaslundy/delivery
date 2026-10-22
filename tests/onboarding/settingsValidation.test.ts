import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createStoreWithOnboarding } from "@/lib/onboarding/progress";
import { PATCH } from "@/app/api/stores/[storeId]/settings/route";

describe("settings route validation", () => {
  let storeId: string;
  afterEach(async () => {
    await prisma.store.delete({ where: { id: storeId } });
    await prisma.account.deleteMany({ where: { email: { startsWith: "owner-settings-val" } } });
  });

  function hostFor(slug: string) {
    return { headers: { host: `${slug}.dominio.com` } };
  }

  it("rejects a negative tableCount", async () => {
    const { store } = await createStoreWithOnboarding({ slug: "settings-val-1", name: "T", ownerEmail: "owner-settings-val-1@test.com", ownerPassword: "senha12345" });
    storeId = store.id;
    const res = await PATCH(
      new Request("http://x", { method: "PATCH", body: JSON.stringify({ tableCount: -5 }), ...hostFor("settings-val-1") }),
      { params: Promise.resolve({ storeId }) } as any,
    );
    expect(res.status).toBe(400);
  });

  it("rejects a negative estimatedDeliveryMinutes", async () => {
    const { store } = await createStoreWithOnboarding({ slug: "settings-val-2", name: "T", ownerEmail: "owner-settings-val-2@test.com", ownerPassword: "senha12345" });
    storeId = store.id;
    const res = await PATCH(
      new Request("http://x", { method: "PATCH", body: JSON.stringify({ estimatedDeliveryMinutes: -1 }), ...hostFor("settings-val-2") }),
      { params: Promise.resolve({ storeId }) } as any,
    );
    expect(res.status).toBe(400);
  });

  it("rejects businessHours that isn't an array", async () => {
    const { store } = await createStoreWithOnboarding({ slug: "settings-val-3", name: "T", ownerEmail: "owner-settings-val-3@test.com", ownerPassword: "senha12345" });
    storeId = store.id;
    const res = await PATCH(
      new Request("http://x", { method: "PATCH", body: JSON.stringify({ businessHours: "nao sou array" }), ...hostFor("settings-val-3") }),
      { params: Promise.resolve({ storeId }) } as any,
    );
    expect(res.status).toBe(400);
  });

  it("does not mark step3HoursDone when businessHours is cleared with null", async () => {
    const { store } = await createStoreWithOnboarding({ slug: "settings-val-4", name: "T", ownerEmail: "owner-settings-val-4@test.com", ownerPassword: "senha12345" });
    storeId = store.id;
    await PATCH(
      new Request("http://x", { method: "PATCH", body: JSON.stringify({ businessHours: null }), ...hostFor("settings-val-4") }),
      { params: Promise.resolve({ storeId }) } as any,
    );
    const progress = await prisma.storeOnboardingProgress.findUniqueOrThrow({ where: { storeId } });
    expect(progress.step3HoursDone).toBe(false);
  });
});
