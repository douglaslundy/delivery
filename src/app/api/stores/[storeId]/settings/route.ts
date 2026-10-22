import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStoreRequestAuthorized } from "@/lib/menu/guard";
import { markStepDone } from "@/lib/onboarding/progress";

const ALLOWED_FIELDS = ["businessHours", "estimatedDeliveryMinutes", "tableCount", "hasPdv"] as const;

function pickAllowedFields(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in body) {
      data[field] = body[field];
    }
  }
  return data;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json();

  const store = await prisma.store.update({
    where: { id: storeId },
    data: pickAllowedFields(body),
  });

  if ("businessHours" in body) {
    await markStepDone(storeId, "step3HoursDone");
  }
  if ("estimatedDeliveryMinutes" in body) {
    await markStepDone(storeId, "step6DeliveryTimeDone");
  }
  if ("tableCount" in body || "hasPdv" in body) {
    await markStepDone(storeId, "step7SalaoStructureDone");
  }

  return NextResponse.json(store);
}
