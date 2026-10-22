import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStoreRequestAuthorized } from "@/lib/menu/guard";
import { markStepDone } from "@/lib/onboarding/progress";

export async function GET(request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const zones = await prisma.deliveryZone.findMany({ where: { storeId } });
  return NextResponse.json(zones);
}

export async function POST(request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json();

  const zone = await prisma.deliveryZone.create({
    data: { storeId, name: body.name, feeCents: body.feeCents },
  });

  await markStepDone(storeId, "step4DeliveryAreaDone");

  return NextResponse.json(zone, { status: 201 });
}
