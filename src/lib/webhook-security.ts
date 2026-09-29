import { timingSafeEqual } from "node:crypto";

export function validWebhookSecret(provided: string | null, expected: string | undefined) {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function safeWebhookHeaders(headers: Headers): Record<string, string> {
  // Allowlist transport metadata; never persist credentials or arbitrary provider headers.
  return Object.fromEntries(["content-type", "content-length", "user-agent"]
    .filter(key => headers.has(key)).map(key => [key, headers.get(key)!]));
}
