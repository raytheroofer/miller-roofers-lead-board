import bcrypt from "bcryptjs";
import crypto, { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { isAllowlistedEmail, staffFromEmail } from "@/lib/users";

export const MIN_PASSWORD_LENGTH = 12;
export const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
  }
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) return false;
  return bcrypt.compare(password, hash);
}

export function getAppBaseUrl(): string {
  if (process.env.AUTH_URL) return process.env.AUTH_URL.replace(/\/+$/, "");
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL.replace(/\/+$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/\/+$/, "")}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/+$/, "")}`;
  }
  return "http://localhost:43177";
}

async function trySendInviteEmail(email: string, inviteUrl: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "MRS Leaderboard <onboarding@resend.dev>",
        to: email,
        subject: "Your invitation to MRS Leaderboard",
        html: `
          <p>You have been invited to access the MRS Leaderboard (Miller Roofing Solutions LLC).</p>
          <p>Please click the link below to set your password and activate your account:</p>
          <p><a href="${inviteUrl}">Set Your Password</a></p>
          <p>Or copy this URL into your browser:</p>
          <p>${inviteUrl}</p>
          <p>This invite link will expire in 7 days.</p>
        `,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function createStaffInvite({
  email,
  actorRole,
}: {
  email: string;
  actorRole?: string;
}): Promise<{
  token: string;
  inviteUrl: string;
  relativeUrl: string;
  email: string;
  expiresAt: Date;
  emailSent: boolean;
}> {
  if (actorRole && actorRole !== "owner" && actorRole !== "firstmate") {
    throw new Error("Unauthorized: Only owners or ops can create invites");
  }

  const normalized = email.trim().toLowerCase();
  if (!isAllowlistedEmail(normalized)) {
    throw new Error(`Email ${normalized} is not on the staff allowlist`);
  }

  let user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user) {
    const staff = staffFromEmail(normalized);
    user = await prisma.user.create({
      data: {
        email: normalized,
        name: staff.name,
        slug: staff.slug,
        role: staff.role,
        inRrPool: staff.inRrPool,
      },
    });
  }

  const token = generateToken();
  const inviteTokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      inviteTokenHash,
      inviteExpiresAt: expiresAt,
    },
  });

  const relativeUrl = `/invite/${token}`;
  const inviteUrl = `${getAppBaseUrl()}${relativeUrl}`;
  const emailSent = await trySendInviteEmail(normalized, inviteUrl);

  return {
    token,
    inviteUrl,
    relativeUrl,
    email: normalized,
    expiresAt,
    emailSent,
  };
}

export async function validateInviteToken(token: string): Promise<
  | {
      valid: true;
      user: {
        id: string;
        email: string;
        name: string;
        role: string;
        expiresAt: Date;
      };
    }
  | {
      valid: false;
      reason: "invalid" | "expired";
      expiredAt?: Date;
    }
> {
  if (!token || typeof token !== "string") {
    return { valid: false, reason: "invalid" };
  }

  const tokenHash = hashToken(token.trim());
  const user = await prisma.user.findUnique({
    where: { inviteTokenHash: tokenHash },
  });

  if (!user) {
    return { valid: false, reason: "invalid" };
  }

  if (user.inviteExpiresAt && user.inviteExpiresAt.getTime() < Date.now()) {
    return {
      valid: false,
      reason: "expired",
      expiredAt: user.inviteExpiresAt,
    };
  }

  return {
    valid: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      expiresAt: user.inviteExpiresAt!,
    },
  };
}

export async function setPasswordFromInvite({
  token,
  password,
  confirmPassword,
}: {
  token: string;
  password: string;
  confirmPassword?: string;
}): Promise<{ success: true; email: string }> {
  if (confirmPassword !== undefined && password !== confirmPassword) {
    throw new Error("Passwords do not match");
  }

  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
  }

  const validation = await validateInviteToken(token);
  if (!validation.valid) {
    if (validation.reason === "expired") {
      throw new Error("Invite link has expired. Please ask Raymond for a new invite.");
    }
    throw new Error("Invalid or already used invite link.");
  }

  const passwordHash = await hashPassword(password);

  await prisma.user.update({
    where: { id: validation.user.id },
    data: {
      passwordHash,
      passwordSetAt: new Date(),
      inviteTokenHash: null,
      inviteExpiresAt: null,
    },
  });

  return { success: true, email: validation.user.email };
}

export async function canCreateBootstrapInvite(): Promise<boolean> {
  const configuredSecret = process.env.BOOTSTRAP_INVITE_SECRET?.trim();
  if (!configuredSecret) return false;

  const count = await prisma.user.count({
    where: { passwordSetAt: { not: null } },
  });
  return count === 0;
}

export async function createBootstrapInvite({
  secret,
}: {
  secret: string;
}): Promise<{
  token: string;
  inviteUrl: string;
  relativeUrl: string;
  email: string;
  expiresAt: Date;
}> {
  const configuredSecret = process.env.BOOTSTRAP_INVITE_SECRET?.trim();
  if (!configuredSecret) {
    throw new Error("BOOTSTRAP_INVITE_SECRET is not configured on this server");
  }

  if (!safeEqual(secret.trim(), configuredSecret)) {
    throw new Error("Invalid bootstrap secret");
  }

  const allowed = await canCreateBootstrapInvite();
  if (!allowed) {
    throw new Error("Bootstrap locked: an account has already set a password");
  }

  const ownerEmail = (process.env.BOOTSTRAP_OWNER_EMAIL || "ray@mrsroofers.com")
    .trim()
    .toLowerCase();

  const invite = await createStaffInvite({ email: ownerEmail });
  return {
    token: invite.token,
    inviteUrl: invite.inviteUrl,
    relativeUrl: invite.relativeUrl,
    email: invite.email,
    expiresAt: invite.expiresAt,
  };
}

export async function listStaffWithAuthStatus() {
  const dbUsers = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
  });

  const now = Date.now();

  return dbUsers.map((user) => {
    const hasPassword = Boolean(user.passwordHash && user.passwordSetAt);
    const hasPendingInvite = Boolean(
      user.inviteTokenHash && user.inviteExpiresAt && user.inviteExpiresAt.getTime() > now,
    );
    const isInviteExpired = Boolean(
      user.inviteTokenHash && user.inviteExpiresAt && user.inviteExpiresAt.getTime() <= now,
    );

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      slug: user.slug,
      inRrPool: user.inRrPool,
      hasPassword,
      passwordSetAt: user.passwordSetAt,
      hasPendingInvite,
      isInviteExpired,
      inviteExpiresAt: user.inviteExpiresAt,
    };
  });
}
