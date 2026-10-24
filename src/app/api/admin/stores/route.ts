import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { denyUnlessPlatformAdmin } from "@/lib/admin/apiGuard";
import { listStoresWithUsage } from "@/lib/admin/stores";
import { createStoreWithOnboarding } from "@/lib/onboarding/progress";

export async function GET() {
  const denied = await denyUnlessPlatformAdmin();
  if (denied) return denied;
  return NextResponse.json(await listStoresWithUsage());
}

export async function POST(request: Request) {
  const denied = await denyUnlessPlatformAdmin();
  if (denied) return denied;
  const body = await request.json();
  if (!body.name || !body.slug || !body.ownerEmail || !body.ownerPassword) {
    return NextResponse.json({ error: "name, slug, ownerEmail e ownerPassword são obrigatórios" }, { status: 400 });
  }
  if (!/^[a-z0-9-]+$/.test(body.slug)) {
    return NextResponse.json({ error: "slug deve ter só letras minúsculas, números e hífen" }, { status: 400 });
  }
  try {
    const { store } = await createStoreWithOnboarding({
      slug: body.slug,
      name: body.name,
      foodCategory: body.foodCategory || undefined,
      ownerEmail: body.ownerEmail,
      ownerPassword: body.ownerPassword,
    });
    if (body.planId) await prisma.store.update({ where: { id: store.id }, data: { planId: body.planId } });
    return NextResponse.json(store, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "slug ou e-mail do dono já existe" }, { status: 409 });
    }
    throw e;
  }
}
