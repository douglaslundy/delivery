import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStoreRequestAuthorized } from "@/lib/menu/guard";

export async function GET(request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const tickets = await prisma.supportTicket.findMany({ where: { storeId } });
  return NextResponse.json(tickets);
}

export async function POST(request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json();

  const ticket = await prisma.supportTicket.create({
    data: { storeId, customerId: body.customerId ?? null, subject: body.subject, status: body.status ?? "OPEN" },
  });

  return NextResponse.json(ticket, { status: 201 });
}
