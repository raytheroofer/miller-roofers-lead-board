export const DEFAULT_ALLOWED_EMAILS = [
  "ray@mrsroofers.com",
  "austin@mrsroofers.com",
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
    email: "austin@mrsroofers.com",
    name: "Austin Maddox",
    slug: "austin",
    role: "pm",
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
  const fromEnv = process.env.ALLOWED_EMAILS?.split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const firstmate = (process.env.FIRSTMATE_EMAIL ?? "firstmate@mrsroofers.com")
    .trim()
    .toLowerCase();
  const base = fromEnv && fromEnv.length > 0 ? fromEnv : [...DEFAULT_ALLOWED_EMAILS];
  return Array.from(new Set([...base.map((v) => v.toLowerCase()), firstmate]));
}

export function firstmateEmail(): string {
  return (process.env.FIRSTMATE_EMAIL ?? "firstmate@mrsroofers.com").trim().toLowerCase();
}

export function isAllowlistedEmail(email: string): boolean {
  return allowedEmails().includes(email.trim().toLowerCase());
}

export function staffFromEmail(email: string) {
  const normalized = email.trim().toLowerCase();
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
