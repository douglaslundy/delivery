import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStoreRequestAuthorized } from "@/lib/menu/guard";

const ALLOWED_FIELDS = ["subject", "status", "resolvedAt"] as const;

function pickAllowedFields(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in body) {
      data[field] = body[field];
    }
  }
  return data;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ storeId: string; ticketId: string }> },
) {
  const { storeId, ticketId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const ticket = await prisma.supportTicket.findFirst({ where: { id: ticketId, storeId } });
  if (!ticket) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json(ticket);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ storeId: string; ticketId: string }> },
) {
  const { storeId, ticketId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json();

  const { count } = await prisma.supportTicket.updateMany({
    where: { id: ticketId, storeId },
    data: pickAllowedFields(body),
  });

  if (count === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const ticket = await prisma.supportTicket.findUniqueOrThrow({ where: { id: ticketId } });
  return NextResponse.json(ticket);
}
