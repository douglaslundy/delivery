import { NextResponse } from "next/server";
import { isStoreRequestAuthorized } from "@/lib/menu/guard";
import { completeReview } from "@/lib/onboarding/progress";

export async function POST(request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    await completeReview(storeId);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
