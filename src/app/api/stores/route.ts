import { NextResponse } from "next/server";
import { createStoreWithOnboarding } from "@/lib/onboarding/progress";

export async function POST(request: Request) {
  const body = await request.json();

  const { store, progress } = await createStoreWithOnboarding({
    slug: body.slug,
    name: body.name,
    foodCategory: body.foodCategory,
  });

  return NextResponse.json({ store, progress }, { status: 201 });
}
