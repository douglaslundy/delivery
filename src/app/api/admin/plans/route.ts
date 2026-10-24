import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { denyUnlessPlatformAdmin } from "@/lib/admin/apiGuard";
import { validatePlan } from "@/lib/plans/validatePlan";

export async function GET() {
  const denied = await denyUnlessPlatformAdmin();
  if (denied) return denied;
  const plans = await prisma.plan.findMany({ orderBy: { priceCents: "asc" }, include: { _count: { select: { stores: true } } } });
  return NextResponse.json(plans);
}

export async function POST(request: Request) {
  const denied = await denyUnlessPlatformAdmin();
  if (denied) return denied;
  const { data, error } = validatePlan(await request.json());
  if (error) return NextResponse.json({ error }, { status: 400 });
  const plan = await prisma.plan.create({ data: data as never });
  return NextResponse.json(plan, { status: 201 });
}
