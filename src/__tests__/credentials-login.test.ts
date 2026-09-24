import { describe, expect, it, beforeEach, vi } from "vitest";
import bcrypt from "bcryptjs";

type MockUser = {
  id: string;
  email: string;
  name: string;
  slug: string;
  role: string;
  inRrPool: boolean;
  passwordHash: string | null;
  inviteTokenHash: string | null;
  inviteExpiresAt: Date | null;
  passwordSetAt: Date | null;
};

let usersStore: MockUser[] = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { email?: string; id?: string } }) => {
        if (where.email) {
          return usersStore.find((u) => u.email === where.email) ?? null;
        }
        if (where.id) {
          return usersStore.find((u) => u.id === where.id) ?? null;
        }
        return null;
      }),
    },
  },
}));

// We can extract and test the authorize logic directly or via the auth module
import { isAllowlistedEmail, staffFromEmail, firstmateEmail } from "@/lib/users";
import { safeEqual, verifyPassword } from "@/lib/auth-service";
import { prisma } from "@/lib/prisma";

async function testAuthorize(credentials: { email?: string; password?: string }) {
  const email = String(credentials?.email ?? "")
    .trim()
    .toLowerCase();
  const password = String(credentials?.password ?? "");
  if (!email || !password) return null;
  if (!isAllowlistedEmail(email)) return null;

  const user = await prisma.user.findUnique({ where: { email } });

  let authenticated = false;
  if (user?.passwordHash) {
    authenticated = await verifyPassword(password, user.passwordHash);
  } else if (email === firstmateEmail() && process.env.FIRSTMATE_PASSWORD) {
    authenticated = safeEqual(password, process.env.FIRSTMATE_PASSWORD);
  }

  if (!authenticated) return null;

  const staff = staffFromEmail(email);
  return {
    id: user?.id ?? staff.slug,
    email: user?.email ?? staff.email,
    name: user?.name ?? staff.name,
    role: user?.role ?? staff.role,
    slug: user?.slug ?? staff.slug,
    inRrPool: user?.inRrPool ?? staff.inRrPool,
  };
}

describe("NextAuth Credentials Authorization", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    delete process.env.AUTH_PASSWORD;
    process.env.FIRSTMATE_PASSWORD = "ops-bot-secret-password-123";

    const austinHash = await bcrypt.hash("AustinPassword123!", 10);
    const rayHash = await bcrypt.hash("RaymondPassword123!", 10);

    usersStore = [
      {
        id: "ray-id",
        email: "ray@mrsroofers.com",
        name: "Raymond",
        slug: "raymond",
        role: "owner",
        inRrPool: true,
        passwordHash: rayHash,
        inviteTokenHash: null,
        inviteExpiresAt: null,
        passwordSetAt: new Date(),
      },
      {
        id: "austin-id",
        email: "austin@mrsroofers.com",
        name: "Austin Maddox",
        slug: "austin",
        role: "pm",
        inRrPool: true,
        passwordHash: austinHash,
        inviteTokenHash: null,
        inviteExpiresAt: null,
        passwordSetAt: new Date(),
      },
      {
        id: "cody-id",
        email: "cody@mrsroofers.com",
        name: "Cody Boyd",
        slug: "cody",
        role: "pm",
        inRrPool: true,
        passwordHash: null, // Cody has not set a password yet!
        inviteTokenHash: null,
        inviteExpiresAt: null,
        passwordSetAt: null,
      },
      {
        id: "firstmate-id",
        email: "firstmate@mrsroofers.com",
        name: "Firstmate",
        slug: "firstmate",
        role: "firstmate",
        inRrPool: false,
        passwordHash: null,
        inviteTokenHash: null,
        inviteExpiresAt: null,
        passwordSetAt: null,
      },
    ];
  });

  it("authenticates staff member with their own valid password", async () => {
    const user = await testAuthorize({
      email: "austin@mrsroofers.com",
      password: "AustinPassword123!",
    });

    expect(user).not.toBeNull();
    expect(user?.email).toBe("austin@mrsroofers.com");
    expect(user?.name).toBe("Austin Maddox");
    expect(user?.role).toBe("pm");
    expect(user?.inRrPool).toBe(true);
  });

  it("authenticates owner Raymond with his own valid password", async () => {
    const user = await testAuthorize({
      email: "ray@mrsroofers.com",
      password: "RaymondPassword123!",
    });

    expect(user).not.toBeNull();
    expect(user?.email).toBe("ray@mrsroofers.com");
    expect(user?.role).toBe("owner");
  });

  it("rejects login with incorrect password", async () => {
    const user = await testAuthorize({
      email: "austin@mrsroofers.com",
      password: "WrongPassword999!",
    });

    expect(user).toBeNull();
  });

  it("rejects staff member who has not set a password yet (uninvited / pending)", async () => {
    const user = await testAuthorize({
      email: "cody@mrsroofers.com",
      password: "AnyPassword123!",
    });

    expect(user).toBeNull();
  });

  it("strictly rejects shared AUTH_PASSWORD / track-only for staff even if present in env", async () => {
    // Simulate someone setting AUTH_PASSWORD in env
    process.env.AUTH_PASSWORD = "track-only";

    const user = await testAuthorize({
      email: "austin@mrsroofers.com",
      password: "track-only",
    });

    // Austin's password is AustinPassword123!, NOT track-only
    expect(user).toBeNull();

    // Cody has no password set; track-only must NOT work for Cody either
    const codyUser = await testAuthorize({
      email: "cody@mrsroofers.com",
      password: "track-only",
    });
    expect(codyUser).toBeNull();
  });

  it("rejects non-allowlisted emails (like chris@mrsroofers.com)", async () => {
    const user = await testAuthorize({
      email: "chris@mrsroofers.com",
      password: "SomePassword123!",
    });

    expect(user).toBeNull();
  });

  it("authenticates firstmate service bot using FIRSTMATE_PASSWORD", async () => {
    const user = await testAuthorize({
      email: "firstmate@mrsroofers.com",
      password: "ops-bot-secret-password-123",
    });

    expect(user).not.toBeNull();
    expect(user?.email).toBe("firstmate@mrsroofers.com");
    expect(user?.role).toBe("firstmate");
  });
});
