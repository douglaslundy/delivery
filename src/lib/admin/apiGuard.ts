import { NextResponse } from "next/server";
import { isPlatformAdmin } from "@/lib/admin/guard";

// Para rotas /api/admin: devolve a resposta 403 ou null quando autorizado.
export async function denyUnlessPlatformAdmin(): Promise<NextResponse | null> {
  return (await isPlatformAdmin()) ? null : NextResponse.json({ error: "forbidden" }, { status: 403 });
}
