import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isStoreRequestAuthorized } from "@/lib/menu/guard";
import { assertWithinPlan, planGuard } from "@/lib/plans/enforce";
import { canManageTeam } from "@/lib/team/rules";
import { getActorRole } from "@/lib/team/session";

type Ctx = { params: Promise<{ storeId: string }> };

// Guard comum: host da loja + sessao com papel OWNER/MANAGER.
async function authorize(request: Request, storeId: string) {
  if (!(await isStoreRequestAuthorized(request, storeId))) return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  const role = await getActorRole(storeId);
  if (!canManageTeam(role)) return { error: NextResponse.json({ error: "Sem permissao para gerenciar a equipe" }, { status: 403 }) };
  return { role: role! };
}

export async function GET(request: Request, { params }: Ctx) {
  const { storeId } = await params;
  const auth = await authorize(request, storeId);
  if ("error" in auth) return auth.error;

  const members = await prisma.storeMember.findMany({ where: { storeId }, include: { account: { select: { email: true } } }, orderBy: { role: "asc" } });
  return NextResponse.json(members.map((m) => ({ id: m.id, role: m.role, email: m.account.email })));
}

export async function POST(request: Request, { params }: Ctx) {
  const { storeId } = await params;
  const auth = await authorize(request, storeId);
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = body?.role;
  const password = typeof body?.password === "string" ? body.password : "";
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "E-mail invalido" }, { status: 400 });
  if (role !== "MANAGER" && role !== "ATTENDANT") return NextResponse.json({ error: "Papel invalido" }, { status: 400 });
  if (role === "MANAGER" && auth.role !== "OWNER") return NextResponse.json({ error: "Somente o dono cria gerentes" }, { status: 403 });

  const blocked = await planGuard(() => assertWithinPlan(storeId, "members"));
  if (blocked) return blocked;

  let account = await prisma.account.findUnique({ where: { email } });
  if (account) {
    const already = await prisma.storeMember.findUnique({ where: { accountId_storeId: { accountId: account.id, storeId } } });
    if (already) return NextResponse.json({ error: "Este usuario ja faz parte da equipe" }, { status: 409 });
  } else {
    if (password.length < 8) return NextResponse.json({ error: "Senha inicial com no minimo 8 caracteres" }, { status: 400 });
    account = await prisma.account.create({ data: { email, passwordHash: await bcrypt.hash(password, 10) } });
  }

  const member = await prisma.storeMember.create({ data: { accountId: account.id, storeId, role } });
  return NextResponse.json({ id: member.id, role: member.role, email }, { status: 201 });
}
