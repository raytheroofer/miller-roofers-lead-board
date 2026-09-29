import { afterEach, describe, expect, it, vi } from "vitest";
import { parseEasternInput, easternInput } from "@/lib/eastern-time";
import { isDemoLead } from "@/lib/demo-data";
import { allowedEmails, isAllowlistedEmail, staffFromEmail } from "@/lib/users";
import { safeWebhookHeaders, validWebhookSecret } from "@/lib/webhook-security";

afterEach(() => vi.unstubAllEnvs());

describe("owner recovery boundaries", () => {
  it("keeps a custom owner admitted when team access is deliberately enabled", () => {
    vi.stubEnv("OWNER_ONLY", "false"); vi.stubEnv("OWNER_EMAIL", "owner@example.test");
    vi.stubEnv("ALLOWED_EMAILS", "austin@mrsroofers.com");
    expect(isAllowlistedEmail("owner@example.test")).toBe(true);
    expect(isAllowlistedEmail("austin@mrsroofers.com")).toBe(true);
  });
  it.each(["owner@example.test", "austin@mrsroofers.com"])("gives the configured owner %s the owner role", email => {
    vi.stubEnv("OWNER_EMAIL", email);
    expect(staffFromEmail(email).role).toBe("owner");
  });
  it("denies implicit staff and Firstmate even when the old allowlist is set", () => {
    vi.stubEnv("OWNER_ONLY", "true"); vi.stubEnv("OWNER_EMAIL", "ray@mrsroofers.com");
    vi.stubEnv("ALLOWED_EMAILS", "ray@mrsroofers.com,austin@mrsroofers.com");
    expect(allowedEmails()).toEqual(["ray@mrsroofers.com"]);
    expect(isAllowlistedEmail("firstmate@mrsroofers.com")).toBe(false);
    expect(isAllowlistedEmail("austin@mrsroofers.com")).toBe(false);
  });
  it("does not hide a real contact just because their name matches a seed", () => {
    expect(isDemoLead({ name: "James Whitaker", email: "james@customer.test", leadLogRowId: "LOG-1042" })).toBe(false);
    expect(isDemoLead({ name: "James Whitaker", email: "james.whitaker@example.com", leadLogRowId: "LOG-1042" })).toBe(true);
    expect(isDemoLead({ name: "SYSTEM CHECK — save test", email: null, leadLogRowId: null })).toBe(true);
  });
  it("rejects missing and wrong webhook credentials", () => {
    expect(validWebhookSecret(null, undefined)).toBe(false);
    expect(validWebhookSecret("bad", "secret")).toBe(false);
    expect(validWebhookSecret("secret", "secret")).toBe(true);
  });
  it("does not store either accepted webhook secret header or arbitrary credentials", () => {
    const headers = new Headers({ "x-mrs-webhook-secret": "private", "x-webhook-secret": "private", authorization: "private",
      "x-provider-token": "private", cookie: "private", "content-type": "application/json" });
    expect(safeWebhookHeaders(headers)).toEqual({ "content-type": "application/json" });
  });
});

describe("Eastern appointment and action times", () => {
  it("preserves a September morning in Eastern Time", () => {
    const date = parseEasternInput("2026-09-30T08:00");
    expect(date.toISOString()).toBe("2026-09-30T12:00:00.000Z");
    expect(easternInput(date)).toBe("2026-09-30T08:00");
  });
  it("uses standard time in winter", () => expect(parseEasternInput("2026-12-01T08:00").toISOString()).toBe("2026-12-01T13:00:00.000Z"));
  it.each(["2026-03-08T02:30", "2026-11-01T01:30", "2026-02-30T12:00", "invalid", "2026-09-29"])("rejects invalid or DST-ambiguous time %s", value => {
    expect(() => parseEasternInput(value)).toThrow();
  });
});
