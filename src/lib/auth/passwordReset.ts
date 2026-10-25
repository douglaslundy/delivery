import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const TTL_MS = 60 * 60 * 1000;
export const MIN_PASSWORD = 8;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

// Retorna o token em claro (so vai por e-mail) ou null se a conta nao existe.
export async function createPasswordReset(email: string): Promise<string | null> {
  const account = await prisma.account.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!account) return null;
  const token = randomBytes(32).toString("hex");
  await prisma.passwordReset.create({
    data: { accountId: account.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + TTL_MS) },
  });
  return token;
}

export async function consumePasswordReset(token: string, newPassword: string): Promise<boolean> {
  if (newPassword.length < MIN_PASSWORD) return false;
  const reset = await prisma.passwordReset.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) return false;
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.$transaction([
    prisma.account.update({ where: { id: reset.accountId }, data: { passwordHash } }),
    prisma.passwordReset.updateMany({ where: { accountId: reset.accountId, usedAt: null }, data: { usedAt: new Date() } }),
  ]);
  return true;
}
