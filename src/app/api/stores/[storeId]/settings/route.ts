import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStoreRequestAuthorized } from "@/lib/menu/guard";
import { markStepDone } from "@/lib/onboarding/progress";

const ALLOWED_FIELDS = ["businessHours", "estimatedDeliveryMinutes", "tableCount", "hasPdv", "autoAcceptOrders"] as const;

function pickAllowedFields(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in body) {
      data[field] = body[field];
    }
  }
  return data;
}

function validate(body: Record<string, unknown>): string | null {
  if ("businessHours" in body && body.businessHours !== null && !Array.isArray(body.businessHours)) {
    return "businessHours must be an array or null";
  }
  if ("estimatedDeliveryMinutes" in body && body.estimatedDeliveryMinutes !== null) {
    if (typeof body.estimatedDeliveryMinutes !== "number" || !Number.isInteger(body.estimatedDeliveryMinutes) || body.estimatedDeliveryMinutes < 0) {
      return "estimatedDeliveryMinutes must be a non-negative integer";
    }
  }
  if ("tableCount" in body && body.tableCount !== null) {
    if (typeof body.tableCount !== "number" || !Number.isInteger(body.tableCount) || body.tableCount < 0) {
      return "tableCount must be a non-negative integer";
    }
  }
  if ("hasPdv" in body && typeof body.hasPdv !== "boolean") {
    return "hasPdv must be a boolean";
  }
  if ("autoAcceptOrders" in body && typeof body.autoAcceptOrders !== "boolean") {
    return "autoAcceptOrders must be a boolean";
  }
  return null;
}

export async function GET(request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const store = await prisma.store.findUniqueOrThrow({
    where: { id: storeId },
    select: { autoAcceptOrders: true, tableCount: true, hasPdv: true, estimatedDeliveryMinutes: true, businessHours: true },
  });
  return NextResponse.json(store);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "body must be an object" }, { status: 400 });
  }

  const error = validate(body);
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  const store = await prisma.store.update({
    where: { id: storeId },
    data: pickAllowedFields(body),
  });

  if ("businessHours" in body && body.businessHours !== null) {
    await markStepDone(storeId, "step3HoursDone");
  }
  if ("estimatedDeliveryMinutes" in body && body.estimatedDeliveryMinutes !== null) {
    await markStepDone(storeId, "step6DeliveryTimeDone");
  }
  if (("tableCount" in body && body.tableCount !== null) || "hasPdv" in body) {
    await markStepDone(storeId, "step7SalaoStructureDone");
  }

  return NextResponse.json(store);
}
