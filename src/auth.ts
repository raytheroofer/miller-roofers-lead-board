import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { createHmac, timingSafeEqual } from "crypto";
import { CODY_EMAIL, codyPassword } from "@/lib/cody-access";
import { firstmateEmail, isAllowlistedEmail, ownerEmail, staffFromEmail } from "@/lib/users";

declare module "next-auth" {
  interface Session {
    user: {
      role: string;
      slug: string;
      inRrPool: boolean;
      credentialsCurrent?: boolean;
    } & DefaultSession["user"];
  }

  interface User {
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
  if (email === CODY_EMAIL) return codyPassword();
  if (email === ownerEmail() && process.env.OWNER_PASSWORD) return process.env.OWNER_PASSWORD;
  if (email === firstmateEmail()) {
    return process.env.FIRSTMATE_PASSWORD || process.env.AUTH_PASSWORD;
  }
  return process.env.AUTH_PASSWORD;
}

function codyCredentialVersion(): string | undefined {
  const password = codyPassword();
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  return password && secret ? createHmac("sha256", secret).update(password).digest("hex") : undefined;
}

function ownerCredentialVersion(): string | undefined {
  const privatePassword = process.env.OWNER_PASSWORD;
  const password = privatePassword || process.env.AUTH_PASSWORD || "";
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  // Bind both the active credential and its mode. Removing a private password
  // must not make sessions issued under that password valid in legacy mode.
  return secret ? createHmac("sha256", secret)
    .update(privatePassword ? "private" : "legacy-shared").update("\0").update(password).digest("hex") : undefined;
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

const authConfig = NextAuth({
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
        if (user.email?.toLowerCase() === CODY_EMAIL) token.credentialVersion = codyCredentialVersion();
        if (user.email?.toLowerCase() === ownerEmail()) token.ownerCredentialVersion = ownerCredentialVersion();
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
        session.user.role = typeof token.role === "string" ? token.role : "pm";
        session.user.slug = typeof token.slug === "string" ? token.slug : "unknown";
        session.user.inRrPool = Boolean(token.inRrPool);
        session.user.email = token.email ?? session.user.email;
        session.user.name = token.name ?? session.user.name;
        if (session.user.email?.toLowerCase() === CODY_EMAIL) {
          const version = codyCredentialVersion();
          session.user.credentialsCurrent = Boolean(version && token.credentialVersion === version);
        }
        if (session.user.email?.toLowerCase() === ownerEmail()) {
          const version = ownerCredentialVersion();
          session.user.credentialsCurrent = Boolean(version && token.ownerCredentialVersion === version);
        }
      }
      return session;
    },
  },
});

export const { handlers, signIn, signOut } = authConfig;

// Recheck access on every read and mutation, including already-issued sessions.
export async function auth() {
  const session = await authConfig.auth();
  if (!session?.user?.email || !isAllowlistedEmail(session.user.email)) return null;
  if (session.user.email.toLowerCase() === CODY_EMAIL && !session.user.credentialsCurrent) return null;
  if (session.user.email.toLowerCase() === ownerEmail() && !session.user.credentialsCurrent) return null;
  const currentStaff = staffFromEmail(session.user.email);
  session.user.role = currentStaff.role;
  session.user.slug = currentStaff.slug;
  session.user.inRrPool = currentStaff.inRrPool;
  return session;
}
