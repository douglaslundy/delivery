import { NextResponse } from "next/server";
import { createStoreWithOnboarding } from "@/lib/onboarding/progress";

export async function POST(request: Request) {
  const body = await request.json();

  if (!body.ownerEmail || !body.ownerPassword) {
    return NextResponse.json({ error: "ownerEmail and ownerPassword are required" }, { status: 400 });
  }

  const { store, progress } = await createStoreWithOnboarding({
    slug: body.slug,
    name: body.name,
    foodCategory: body.foodCategory,
    ownerEmail: body.ownerEmail,
    ownerPassword: body.ownerPassword,
  });

  return NextResponse.json({ store, progress }, { status: 201 });
}
