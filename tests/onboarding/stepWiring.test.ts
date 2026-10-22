import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createStoreWithOnboarding } from "@/lib/onboarding/progress";
import { PATCH } from "@/app/api/stores/[storeId]/settings/route";
import { POST as createBankAccount } from "@/app/api/stores/[storeId]/finance/accounts/route";
import { POST as createDeliveryZone } from "@/app/api/stores/[storeId]/delivery-zones/route";
import { POST as createWhatsappInstance } from "@/app/api/stores/[storeId]/whatsapp/route";

describe("step wiring via settings route", () => {
  let storeId: string;
  afterEach(async () => { await prisma.store.delete({ where: { id: storeId } }); });

  function hostFor(slug: string) {
    return { headers: { host: `${slug}.dominio.com` } };
  }

  it("marks step3HoursDone when business hours are saved", async () => {
    const { store } = await createStoreWithOnboarding({ slug: "wiring-teste", name: "T", foodCategory: "x" });
    storeId = store.id;
    await PATCH(
      new Request("http://x", { method: "PATCH", body: JSON.stringify({ businessHours: [{ day: "MON", opensAt: "11:00", closesAt: "23:00" }] }), ...hostFor("wiring-teste") }),
      { params: Promise.resolve({ storeId }) } as any,
    );
    const progress = await prisma.storeOnboardingProgress.findUniqueOrThrow({ where: { storeId } });
    expect(progress.step3HoursDone).toBe(true);
  });

  it("marks step6DeliveryTimeDone when estimatedDeliveryMinutes is saved", async () => {
    const { store } = await createStoreWithOnboarding({ slug: "wiring-teste-2", name: "T", foodCategory: "x" });
    storeId = store.id;
    await PATCH(
      new Request("http://x", { method: "PATCH", body: JSON.stringify({ estimatedDeliveryMinutes: 40 }), ...hostFor("wiring-teste-2") }),
      { params: Promise.resolve({ storeId }) } as any,
    );
    const progress = await prisma.storeOnboardingProgress.findUniqueOrThrow({ where: { storeId } });
    expect(progress.step6DeliveryTimeDone).toBe(true);
  });

  it("marks step7SalaoStructureDone when tableCount/hasPdv is saved", async () => {
    const { store } = await createStoreWithOnboarding({ slug: "wiring-teste-3", name: "T", foodCategory: "x" });
    storeId = store.id;
    await PATCH(
      new Request("http://x", { method: "PATCH", body: JSON.stringify({ tableCount: 10, hasPdv: true }), ...hostFor("wiring-teste-3") }),
      { params: Promise.resolve({ storeId }) } as any,
    );
    const progress = await prisma.storeOnboardingProgress.findUniqueOrThrow({ where: { storeId } });
    expect(progress.step7SalaoStructureDone).toBe(true);
  });

  it("marks step2PaymentDone when a bank account is created", async () => {
    const { store } = await createStoreWithOnboarding({ slug: "wiring-teste-4", name: "T", foodCategory: "x" });
    storeId = store.id;
    await createBankAccount(
      new Request("http://x", { method: "POST", body: JSON.stringify({ name: "Caixa" }), ...hostFor("wiring-teste-4") }),
      { params: Promise.resolve({ storeId }) } as any,
    );
    const progress = await prisma.storeOnboardingProgress.findUniqueOrThrow({ where: { storeId } });
    expect(progress.step2PaymentDone).toBe(true);
  });

  it("marks step4DeliveryAreaDone when a delivery zone is created", async () => {
    const { store } = await createStoreWithOnboarding({ slug: "wiring-teste-5", name: "T", foodCategory: "x" });
    storeId = store.id;
    await createDeliveryZone(
      new Request("http://x", { method: "POST", body: JSON.stringify({ name: "Centro", feeCents: 500 }), ...hostFor("wiring-teste-5") }),
      { params: Promise.resolve({ storeId }) } as any,
    );
    const progress = await prisma.storeOnboardingProgress.findUniqueOrThrow({ where: { storeId } });
    expect(progress.step4DeliveryAreaDone).toBe(true);
  });

  it("marks step5BotDone when a WhatsApp instance is created", async () => {
    const { store } = await createStoreWithOnboarding({ slug: "wiring-teste-6", name: "T", foodCategory: "x" });
    storeId = store.id;
    await createWhatsappInstance(
      new Request("http://x", { method: "POST", body: JSON.stringify({ evolutionInstanceName: `wa-${store.id}`, evolutionApiUrl: "https://exemplo.local", apiKey: "chave" }), ...hostFor("wiring-teste-6") }),
      { params: Promise.resolve({ storeId }) } as any,
    );
    const progress = await prisma.storeOnboardingProgress.findUniqueOrThrow({ where: { storeId } });
    expect(progress.step5BotDone).toBe(true);
  });
});
