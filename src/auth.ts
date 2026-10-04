import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import Google from "next-auth/providers/google";
import Nodemailer from "next-auth/providers/nodemailer";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";

export const devLoginEnabled = process.env.NODE_ENV !== "production";
export const googleEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
export const emailEnabled = Boolean(process.env.EMAIL_SERVER && !process.env.EMAIL_SERVER.includes("example.com"));

const providers: Provider[] = [];
if (googleEnabled) providers.push(Google);
if (emailEnabled) providers.push(Nodemailer({ server: process.env.EMAIL_SERVER, from: process.env.EMAIL_FROM }));
if (devLoginEnabled) {
  providers.push(Credentials({
    id: "dev-login",
    credentials: { email: {} },
    async authorize(c) {
      const email = String(c?.email ?? "").trim().toLowerCase();
      if (!email.includes("@")) return null;
      await db.insert(users).values({ email }).onConflictDoNothing();
      const [u] = await db.select().from(users).where(eq(users.email, email));
      return u ? { id: u.id, email: u.email, name: u.name } : null;
    },
  }));
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users, accountsTable: accounts, sessionsTable: sessions, verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },
  providers,
  callbacks: {
    authorized: ({ auth }) => Boolean(auth?.user),
    jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.uid) session.user.id = token.uid as string;
      return session;
    },
  },
});
