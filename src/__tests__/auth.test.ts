import { describe, expect, it, beforeEach, vi } from "vitest";
import bcrypt from "bcryptjs";
import {
  createStaffInvite,
  validateInviteToken,
  setPasswordFromInvite,
  createBootstrapInvite,
  canCreateBootstrapInvite,
  hashPassword,
  verifyPassword,
  listStaffWithAuthStatus,
  hashToken,
} from "@/lib/auth-service";

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
  createdAt: Date;
  updatedAt: Date;
};

// In-memory mock database for testing
let usersStore: MockUser[] = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { email?: string; inviteTokenHash?: string; id?: string } }) => {
        if (where.email) {
          return usersStore.find((u) => u.email === where.email) ?? null;
        }
        if (where.inviteTokenHash) {
          return usersStore.find((u) => u.inviteTokenHash === where.inviteTokenHash) ?? null;
        }
        if (where.id) {
          return usersStore.find((u) => u.id === where.id) ?? null;
        }
        return null;
      }),
      create: vi.fn(async ({ data }: { data: Partial<MockUser> }) => {
        const newUser: MockUser = {
          id: `user-${Date.now()}-${Math.random()}`,
          email: data.email!,
          name: data.name!,
          slug: data.slug!,
          role: data.role!,
          inRrPool: data.inRrPool ?? false,
          passwordHash: data.passwordHash ?? null,
          inviteTokenHash: data.inviteTokenHash ?? null,
          inviteExpiresAt: data.inviteExpiresAt ?? null,
          passwordSetAt: data.passwordSetAt ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        usersStore.push(newUser);
        return newUser;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<MockUser> }) => {
        const index = usersStore.findIndex((u) => u.id === where.id);
        if (index === -1) throw new Error("User not found");
        usersStore[index] = {
          ...usersStore[index],
          ...data,
          updatedAt: new Date(),
        };
        return usersStore[index];
      }),
      count: vi.fn(async ({ where }: { where?: { passwordSetAt?: { not: null } } }) => {
        if (where?.passwordSetAt?.not === null) {
          return usersStore.filter((u) => u.passwordSetAt !== null).length;
        }
        return usersStore.length;
      }),
      findMany: vi.fn(async () => [...usersStore]),
    },
  },
}));

describe("Authentication & Invite System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BOOTSTRAP_INVITE_SECRET = "test-bootstrap-secret-12345";
    process.env.BOOTSTRAP_OWNER_EMAIL = "ray@mrsroofers.com";
    delete process.env.AUTH_PASSWORD;

    // Seed mock users matching initial deploy (no passwords set)
    usersStore = [
      {
        id: "ray-id",
        email: "ray@mrsroofers.com",
        name: "Raymond",
        slug: "raymond",
        role: "owner",
        inRrPool: true,
        passwordHash: null,
        inviteTokenHash: null,
        inviteExpiresAt: null,
        passwordSetAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "austin-id",
        email: "austin@mrsroofers.com",
        name: "Austin Maddox",
        slug: "austin",
        role: "pm",
        inRrPool: true,
        passwordHash: null,
        inviteTokenHash: null,
        inviteExpiresAt: null,
        passwordSetAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "cody-id",
        email: "cody@mrsroofers.com",
        name: "Cody Boyd",
        slug: "cody",
        role: "pm",
        inRrPool: true,
        passwordHash: null,
        inviteTokenHash: null,
        inviteExpiresAt: null,
        passwordSetAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  });

  describe("Password Hashing & Verification", () => {
    it("hashes passwords and verifies them with bcrypt", async () => {
      const password = "SuperSecretPassword123!";
      const hash = await hashPassword(password);

      expect(hash).toMatch(/^\$2[aby]\$\d+\$/);
      expect(await verifyPassword(password, hash)).toBe(true);
      expect(await verifyPassword("WrongPassword123!", hash)).toBe(false);
    });

    it("enforces minimum 12 character password length", async () => {
      await expect(hashPassword("short123")).rejects.toThrow(/at least 12 characters/i);
    });
  });

  describe("Invite Creation", () => {
    it("allows owner to create invite for allowlisted staff", async () => {
      const invite = await createStaffInvite({
        email: "austin@mrsroofers.com",
        actorRole: "owner",
      });

      expect(invite.token).toHaveLength(64);
      expect(invite.email).toBe("austin@mrsroofers.com");
      expect(invite.inviteUrl).toContain(`/invite/${invite.token}`);
      expect(invite.expiresAt.getTime()).toBeGreaterThan(Date.now());

      const user = usersStore.find((u) => u.email === "austin@mrsroofers.com");
      expect(user?.inviteTokenHash).toBe(hashToken(invite.token));
      expect(user?.inviteExpiresAt).toEqual(invite.expiresAt);
    });

    it("allows firstmate to create invites", async () => {
      const invite = await createStaffInvite({
        email: "cody@mrsroofers.com",
        actorRole: "firstmate",
      });

      expect(invite.token).toBeDefined();
      expect(invite.email).toBe("cody@mrsroofers.com");
    });

    it("blocks PM or unauthorized roles from creating invites", async () => {
      await expect(
        createStaffInvite({
          email: "austin@mrsroofers.com",
          actorRole: "pm",
        }),
      ).rejects.toThrow(/Unauthorized/i);
    });

    it("rejects non-allowlisted emails (like chris@mrsroofers.com)", async () => {
      await expect(
        createStaffInvite({
          email: "chris@mrsroofers.com",
          actorRole: "owner",
        }),
      ).rejects.toThrow(/not on the staff allowlist/i);
    });
  });

  describe("Token Validation & Password Setting", () => {
    it("validates valid invite token", async () => {
      const invite = await createStaffInvite({
        email: "austin@mrsroofers.com",
        actorRole: "owner",
      });

      const validation = await validateInviteToken(invite.token);
      expect(validation.valid).toBe(true);
      if (validation.valid) {
        expect(validation.user.email).toBe("austin@mrsroofers.com");
        expect(validation.user.name).toBe("Austin Maddox");
      }
    });

    it("rejects invalid tokens", async () => {
      const validation = await validateInviteToken("non-existent-token-12345");
      expect(validation.valid).toBe(false);
      if (!validation.valid) {
        expect(validation.reason).toBe("invalid");
      }
    });

    it("rejects expired tokens", async () => {
      const invite = await createStaffInvite({
        email: "austin@mrsroofers.com",
        actorRole: "owner",
      });

      // Manually set expiry in the past
      const user = usersStore.find((u) => u.email === "austin@mrsroofers.com")!;
      user.inviteExpiresAt = new Date(Date.now() - 1000 * 60);

      const validation = await validateInviteToken(invite.token);
      expect(validation.valid).toBe(false);
      if (!validation.valid) {
        expect(validation.reason).toBe("expired");
      }

      await expect(
        setPasswordFromInvite({
          token: invite.token,
          password: "validPassword123!",
          confirmPassword: "validPassword123!",
        }),
      ).rejects.toThrow(/expired/i);
    });

    it("successfully sets password and marks invite as used (single-use)", async () => {
      const invite = await createStaffInvite({
        email: "austin@mrsroofers.com",
        actorRole: "owner",
      });

      const password = "myNewUniquePassword2026!";
      const result = await setPasswordFromInvite({
        token: invite.token,
        password,
        confirmPassword: password,
      });

      expect(result.success).toBe(true);
      expect(result.email).toBe("austin@mrsroofers.com");

      const user = usersStore.find((u) => u.email === "austin@mrsroofers.com")!;
      expect(user.passwordHash).not.toBeNull();
      expect(await bcrypt.compare(password, user.passwordHash!)).toBe(true);
      expect(user.passwordSetAt).not.toBeNull();
      expect(user.inviteTokenHash).toBeNull();
      expect(user.inviteExpiresAt).toBeNull();

      // Test token reuse prevention: second attempt with same token must fail
      const secondValidation = await validateInviteToken(invite.token);
      expect(secondValidation.valid).toBe(false);

      await expect(
        setPasswordFromInvite({
          token: invite.token,
          password: "anotherPassword123!",
          confirmPassword: "anotherPassword123!",
        }),
      ).rejects.toThrow(/invalid or already used/i);
    });

    it("rejects passwords shorter than 12 characters", async () => {
      const invite = await createStaffInvite({
        email: "austin@mrsroofers.com",
        actorRole: "owner",
      });

      await expect(
        setPasswordFromInvite({
          token: invite.token,
          password: "shortpass",
          confirmPassword: "shortpass",
        }),
      ).rejects.toThrow(/at least 12 characters/i);
    });

    it("rejects mismatched confirm password", async () => {
      const invite = await createStaffInvite({
        email: "austin@mrsroofers.com",
        actorRole: "owner",
      });

      await expect(
        setPasswordFromInvite({
          token: invite.token,
          password: "Password12345678!",
          confirmPassword: "DifferentPassword12345!",
        }),
      ).rejects.toThrow(/passwords do not match/i);
    });
  });

  describe("Bootstrap Initial Setup", () => {
    it("allows bootstrap when no user has set a password", async () => {
      expect(await canCreateBootstrapInvite()).toBe(true);

      const invite = await createBootstrapInvite({
        secret: "test-bootstrap-secret-12345",
      });

      expect(invite.email).toBe("ray@mrsroofers.com");
      expect(invite.token).toBeDefined();
    });

    it("rejects bootstrap with invalid secret", async () => {
      await expect(
        createBootstrapInvite({
          secret: "wrong-secret",
        }),
      ).rejects.toThrow(/invalid bootstrap secret/i);
    });

    it("locks bootstrap once any user has set a password", async () => {
      // Austin sets a password
      const austinInvite = await createStaffInvite({
        email: "austin@mrsroofers.com",
        actorRole: "owner",
      });
      await setPasswordFromInvite({
        token: austinInvite.token,
        password: "ValidPasswordAustin123!",
        confirmPassword: "ValidPasswordAustin123!",
      });

      // Now bootstrap should be locked
      expect(await canCreateBootstrapInvite()).toBe(false);

      await expect(
        createBootstrapInvite({
          secret: "test-bootstrap-secret-12345",
        }),
      ).rejects.toThrow(/locked/i);
    });
  });

  describe("Staff Directory Status", () => {
    it("reports correct password and invite status for staff", async () => {
      // 1. Initially no password or invite
      let list = await listStaffWithAuthStatus();
      const initialAustin = list.find((u) => u.email === "austin@mrsroofers.com")!;
      expect(initialAustin.hasPassword).toBe(false);
      expect(initialAustin.hasPendingInvite).toBe(false);

      // 2. After invite created
      const invite = await createStaffInvite({
        email: "austin@mrsroofers.com",
        actorRole: "owner",
      });
      list = await listStaffWithAuthStatus();
      const invitedAustin = list.find((u) => u.email === "austin@mrsroofers.com")!;
      expect(invitedAustin.hasPassword).toBe(false);
      expect(invitedAustin.hasPendingInvite).toBe(true);

      // 3. After password set
      await setPasswordFromInvite({
        token: invite.token,
        password: "ValidPasswordAustin123!",
        confirmPassword: "ValidPasswordAustin123!",
      });
      list = await listStaffWithAuthStatus();
      const activeAustin = list.find((u) => u.email === "austin@mrsroofers.com")!;
      expect(activeAustin.hasPassword).toBe(true);
      expect(activeAustin.hasPendingInvite).toBe(false);
    });
  });
});
