import { CODY_EMAIL, codyPassword } from "@/lib/cody-access";

const REVOKED_EMAILS = new Set(["austin@mrsroofers.com"]);

export const DEFAULT_ALLOWED_EMAILS = [
  "ray@mrsroofers.com",
  "cody@mrsroofers.com",
] as const;

export const STAFF_DIRECTORY = [
  {
    email: "ray@mrsroofers.com",
    name: "Raymond",
    slug: "raymond",
    role: "owner",
    inRrPool: true,
  },
  {
    email: "cody@mrsroofers.com",
    name: "Cody Boyd",
    slug: "cody",
    role: "pm",
    inRrPool: true,
  },
  {
    email: "chris@mrsroofers.com",
    name: "Chris Bell",
    slug: "chris_bell",
    role: "other",
    inRrPool: false,
  },
] as const;

export function allowedEmails(): string[] {
  const ownerAndCody = [ownerEmail(), ...(codyPassword() ? [CODY_EMAIL] : [])];
  if (process.env.OWNER_ONLY !== "false") return ownerAndCody.filter(email => !REVOKED_EMAILS.has(email));
  const fromEnv = process.env.ALLOWED_EMAILS?.split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const firstmate = (process.env.FIRSTMATE_EMAIL ?? "firstmate@mrsroofers.com")
    .trim()
    .toLowerCase();
  const base = fromEnv && fromEnv.length > 0 ? fromEnv : [...DEFAULT_ALLOWED_EMAILS];
  return Array.from(new Set([...ownerAndCody, ...base.map((v) => v.toLowerCase()), firstmate]))
    .filter(email => !REVOKED_EMAILS.has(email) && (email !== CODY_EMAIL || Boolean(codyPassword())));
}

export function ownerEmail(): string {
  return (process.env.OWNER_EMAIL || "ray@mrsroofers.com").trim().toLowerCase();
}

export function firstmateEmail(): string {
  return (process.env.FIRSTMATE_EMAIL ?? "firstmate@mrsroofers.com").trim().toLowerCase();
}

export function isAllowlistedEmail(email: string): boolean {
  return allowedEmails().includes(email.trim().toLowerCase());
}

export function staffFromEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  if (normalized === ownerEmail()) {
    const knownOwner = STAFF_DIRECTORY.find(person => person.email === normalized);
    return { email: normalized, name: knownOwner?.name ?? "Owner", slug: knownOwner?.slug ?? "owner",
      role: "owner" as const, inRrPool: knownOwner?.inRrPool ?? false };
  }
  if (normalized === firstmateEmail()) {
    return {
      email: normalized,
      name: "Firstmate",
      slug: "firstmate",
      role: "firstmate" as const,
      inRrPool: false,
    };
  }
  const known = STAFF_DIRECTORY.find((person) => person.email === normalized);
  if (known) {
    return { ...known, email: normalized };
  }
  return {
    email: normalized,
    name: normalized.split("@")[0] ?? normalized,
    slug: normalized.split("@")[0] ?? "user",
    role: "pm" as const,
    inRrPool: false,
  };
}

export function canOverrideStages(role: string | undefined): boolean {
  return role === "owner" || role === "firstmate";
}
