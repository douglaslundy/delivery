import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";

export async function isPlatformAdmin(): Promise<boolean> {
  const session = (await getServerSession(authOptions)) as { isPlatformAdmin?: boolean } | null;
  return session?.isPlatformAdmin === true;
}

// Para paginas/layouts: nao-admin vai para o login.
export async function requirePlatformAdmin(): Promise<void> {
  if (!(await isPlatformAdmin())) redirect("/login");
}
