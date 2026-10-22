import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const account = await prisma.account.findUnique({ where: { email: credentials.email } });
        if (!account) {
          return null;
        }

        const valid = await bcrypt.compare(credentials.password, account.passwordHash);
        if (!valid) {
          return null;
        }

        return { id: account.id };
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      const memberships = await prisma.storeMember.findMany({ where: { accountId: token.sub } });

      return {
        ...session,
        storeId: memberships.length === 1 ? memberships[0].storeId : null,
        availableStoreIds: memberships.map((m) => m.storeId),
      };
    },
  },
};
