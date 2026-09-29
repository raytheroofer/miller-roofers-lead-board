// A dedicated credential enables only Cody; it does not enable the legacy team allowlist.
export const CODY_EMAIL = "cody@mrsroofers.com";

export function codyPassword(): string | undefined {
  const password = process.env.CODY_PASSWORD;
  if (!password || password.length < 16) return undefined;
  if ([process.env.AUTH_PASSWORD, process.env.OWNER_PASSWORD, process.env.FIRSTMATE_PASSWORD].includes(password)) return undefined;
  return password;
}
