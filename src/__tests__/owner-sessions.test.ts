import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextAuthConfig } from "next-auth";
import type { JWT } from "next-auth/jwt";

const state = vi.hoisted(() => ({ config: null as unknown, session: null as unknown }));
vi.mock("next-auth", () => ({ default: (config: NextAuthConfig) => {
  state.config = config;
  return { auth: async () => state.session, handlers: {}, signIn: vi.fn(), signOut: vi.fn() };
} }));
import { auth } from "@/auth";

const email = "ray@mrsroofers.com";
async function issueOwnerToken() {
  const config = state.config as NextAuthConfig;
  return await config.callbacks!.jwt!({ token: {}, user: { id: "raymond", email, role: "owner", slug: "raymond" } } as never) as JWT;
}
async function readOwner(token: JWT) {
  const config = state.config as NextAuthConfig;
  state.session = await config.callbacks!.session!({ token, session: { user: { email }, expires: "2099-01-01" } } as never);
  return auth();
}
beforeEach(() => {
  vi.stubEnv("OWNER_EMAIL", email);
  vi.stubEnv("OWNER_ONLY", "true");
  vi.stubEnv("AUTH_SECRET", "synthetic-session-secret");
  vi.stubEnv("AUTH_PASSWORD", "synthetic-legacy-password");
  vi.stubEnv("OWNER_PASSWORD", "synthetic-private-password");
});
afterEach(() => vi.unstubAllEnvs());

describe("owner session credential binding", () => {
  it("revokes a private owner session on removal while allowing a fresh legacy sign-in", async () => {
    const privateToken = await issueOwnerToken();
    expect((await readOwner(privateToken))?.user.email).toBe(email);
    vi.stubEnv("OWNER_PASSWORD", "");
    expect(await readOwner(privateToken)).toBeNull();
    expect((await readOwner(await issueOwnerToken()))?.user.email).toBe(email);
  });
  it("treats changing credential mode as revocation even when the password values match", async () => {
    vi.stubEnv("OWNER_PASSWORD", "synthetic-legacy-password");
    const privateToken = await issueOwnerToken();
    vi.stubEnv("OWNER_PASSWORD", "");
    expect(await readOwner(privateToken)).toBeNull();
  });
  it("revokes legacy sessions when the active shared password changes", async () => {
    vi.stubEnv("OWNER_PASSWORD", "");
    const legacyToken = await issueOwnerToken();
    vi.stubEnv("AUTH_PASSWORD", "synthetic-new-shared-password");
    expect(await readOwner(legacyToken)).toBeNull();
  });
  it("rejects unversioned pre-upgrade owner tokens instead of silently binding them", async () => {
    vi.stubEnv("OWNER_PASSWORD", "");
    expect(await readOwner({ email, role: "owner", slug: "raymond" })).toBeNull();
  });
});
