import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { timingSafeEqual } from "crypto";
import { firstmateEmail, isAllowlistedEmail, staffFromEmail } from "@/lib/users";

declare module "next-auth" {
  interface Session {
    user: {
      role: string;
      slug: string;
      inRrPool: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
    slug?: string;
    inRrPool?: boolean;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role?: string;
    slug?: string;
    inRrPool?: boolean;
  }
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function passwordForEmail(email: string): string | undefined {
  if (email === firstmateEmail()) {
    return process.env.FIRSTMATE_PASSWORD || process.env.AUTH_PASSWORD;
  }
  return process.env.AUTH_PASSWORD;
}

const providers = [
  Credentials({
    id: "credentials",
    name: "MRS login",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const email = String(credentials?.email ?? "")
        .trim()
        .toLowerCase();
      const password = String(credentials?.password ?? "");
      if (!email || !password) return null;
      if (!isAllowlistedEmail(email)) return null;
      const expected = passwordForEmail(email);
      if (!expected || !safeEqual(password, expected)) return null;
      const staff = staffFromEmail(email);
      return {
        id: staff.slug,
        email: staff.email,
        name: staff.name,
        role: staff.role,
        slug: staff.slug,
        inRrPool: staff.inRrPool,
      };
    },
  }),
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }) as never,
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers,
  callbacks: {
    async signIn({ user, account }) {
      const email = user.email?.toLowerCase();
      if (!email) return false;
      if (!isAllowlistedEmail(email)) return false;
      if (account?.provider === "google") {
        const staff = staffFromEmail(email);
        user.name = staff.name;
        user.role = staff.role;
        user.slug = staff.slug;
        user.inRrPool = staff.inRrPool;
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.slug = user.slug;
        token.inRrPool = user.inRrPool;
        token.email = user.email;
        token.name = user.name;
      }
      if (token.email && (!token.role || !token.slug)) {
        const staff = staffFromEmail(String(token.email));
        token.role = staff.role;
        token.slug = staff.slug;
        token.inRrPool = staff.inRrPool;
        token.name = staff.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role ?? "pm";
        session.user.slug = token.slug ?? "unknown";
        session.user.inRrPool = Boolean(token.inRrPool);
        session.user.email = token.email ?? session.user.email;
        session.user.name = token.name ?? session.user.name;
      }
      return session;
    },
  },
});
