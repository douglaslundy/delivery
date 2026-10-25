import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStoreRequestAuthorized } from "@/lib/menu/guard";
import { canManageTeam, checkMemberChange, type Role } from "@/lib/team/rules";
import { getActorRole } from "@/lib/team/session";

type Ctx = { params: Promise<{ storeId: string; memberId: string }> };

async function change(request: Request, { params }: Ctx, newRole?: Role | "REMOVE") {
  const { storeId, memberId } = await params;
  if (!(await isStoreRequestAuthorized(request, storeId))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const actor = await getActorRole(storeId);
  if (!canManageTeam(actor)) return NextResponse.json({ error: "Sem permissao para gerenciar a equipe" }, { status: 403 });

  const members = await prisma.storeMember.findMany({ where: { storeId }, select: { id: true, role: true } });
  const reason = checkMemberChange(actor!, members, memberId, newRole === "REMOVE" ? undefined : newRole);
  if (reason) return NextResponse.json({ error: reason }, { status: reason === "Membro nao encontrado" ? 404 : 409 });
  return null;
}

export async function PATCH(request: Request, ctx: Ctx) {
  const body = await request.json().catch(() => null);
  const role = body?.role;
  if (role !== "OWNER" && role !== "MANAGER" && role !== "ATTENDANT") return NextResponse.json({ error: "Papel invalido" }, { status: 400 });

  const refused = await change(request, ctx, role);
  if (refused) return refused;
  const { memberId } = await ctx.params;
  const member = await prisma.storeMember.update({ where: { id: memberId }, data: { role } });
  return NextResponse.json({ id: member.id, role: member.role });
}

export async function DELETE(request: Request, ctx: Ctx) {
  const refused = await change(request, ctx, "REMOVE");
  if (refused) return refused;
  const { memberId } = await ctx.params;
  await prisma.storeMember.delete({ where: { id: memberId } });
  return NextResponse.json({ ok: true });
}
