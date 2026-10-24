// Cria (ou atualiza) o admin da plataforma.
// Uso:  npx tsx prisma/promote-admin.ts [email] [senha]
// Padrao: admin@admin.com / 12345678. Dentro do container: docker exec delivery-app-1 npx tsx prisma/promote-admin.ts
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

const email = process.argv[2] ?? "admin@admin.com";
const password = process.argv[3] ?? "12345678";

async function main() {
  const passwordHash = await bcrypt.hash(password, 10);
  const account = await prisma.account.upsert({
    where: { email },
    create: { email, passwordHash, isPlatformAdmin: true },
    update: { isPlatformAdmin: true },
  });
  console.log(`OK: ${account.email} agora e admin da plataforma`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
