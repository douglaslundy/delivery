import { assertFeature, planGuard } from "@/lib/plans/enforce";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStoreRequestAuthorized } from "@/lib/menu/guard";

export async function GET(request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  {
    const blocked = await planGuard(() => assertFeature(storeId, "finance"));
    if (blocked) return blocked;
  }

  const categories = await prisma.financeCategory.findMany({ where: { storeId } });
  return NextResponse.json(categories);
}

export async function POST(request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  {
    const blocked = await planGuard(() => assertFeature(storeId, "finance"));
    if (blocked) return blocked;
  }

  const body = await request.json();

  const category = await prisma.financeCategory.create({
    data: { storeId, name: body.name, kind: body.kind },
  });

  return NextResponse.json(category, { status: 201 });
}
