import { describe, it, expect, afterAll, vi } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createPasswordReset, consumePasswordReset } from "@/lib/auth/passwordReset";

const EMAIL = "reset-teste@test.com";

describe("password reset", () => {
  afterAll(async () => {
    await prisma.account.deleteMany({ where: { email: EMAIL } });
  });

  it("returns null for unknown email", async () => {
    expect(await createPasswordReset("naoexiste@test.com")).toBeNull();
  });

  it("changes the password once and rejects reuse, short passwords and expired tokens", async () => {
    await prisma.account.create({ data: { email: EMAIL, passwordHash: await bcrypt.hash("antiga123", 4) } });

    const token = (await createPasswordReset(EMAIL.toUpperCase()))!;
    expect(token).toBeTruthy();
    expect(await consumePasswordReset(token, "curta")).toBe(false);
    expect(await consumePasswordReset(token, "novaSenha123")).toBe(true);

    const account = await prisma.account.findUniqueOrThrow({ where: { email: EMAIL } });
    expect(await bcrypt.compare("novaSenha123", account.passwordHash)).toBe(true);
    expect(await consumePasswordReset(token, "outraSenha123")).toBe(false);

    const expired = (await createPasswordReset(EMAIL))!;
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 2 * 60 * 60 * 1000);
    expect(await consumePasswordReset(expired, "terceiraSenha123")).toBe(false);
    vi.useRealTimers();
  });
});
