import { NextResponse } from "next/server";
import { isStoreRequestAuthorized } from "@/lib/menu/guard";
import { assignDelivery } from "@/lib/delivery/assignDelivery";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ storeId: string; orderId: string }> },
) {
  const { storeId, orderId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json();

  try {
    const order = await assignDelivery(storeId, orderId, body.deliveryPersonId);
    return NextResponse.json(order);
  } catch {
    return NextResponse.json({ error: "order or delivery person not found for this store" }, { status: 400 });
  }
}
