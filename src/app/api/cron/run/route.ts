import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runBillReminders, runSalesRecovery } from "@/lib/cron/jobs";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("x-cron-secret") ?? "");
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(request: Request) {
  if (!authorized(request)) return new NextResponse(null, { status: 401 });
  const recovery = await runSalesRecovery();
  const reminders = await runBillReminders();
  return NextResponse.json({ recovery, reminders });
}
