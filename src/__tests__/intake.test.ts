import { afterEach, describe, expect, it, vi } from "vitest";
import { authorizedIntake, intakeConfiguration } from "@/lib/intake-config";
import { parseIntakeLead, readIntakeBody } from "@/lib/intake-contract";

const fixture = { schemaVersion: 1, recordId: "provider-001", name: "SYSTEM CHECK — intake", receivedAt: "2026-09-22T21:41:00Z", phone: "(904) 555-0100" };
afterEach(() => vi.unstubAllEnvs());
function configure() {
  vi.stubEnv("LEAD_INTAKE_SOURCES", "website,remodel-favor");
  vi.stubEnv("OWNER_PASSWORD", "isolated-owner-credential");
  vi.stubEnv("AUTH_PASSWORD", "isolated-legacy-credential");
  vi.stubEnv("CODY_PASSWORD", "isolated-cody-credential");
  vi.stubEnv("INTAKE_WEBSITE_KEY", "a".repeat(64));
  vi.stubEnv("INTAKE_REMODEL_FAVOR_KEY", "b".repeat(64));
}
describe("provider credentials", () => {
  it("defaults off and does not use legacy webhook settings", () => {
    vi.stubEnv("LEAD_INTAKE_SOURCES", ""); vi.stubEnv("FEATURE_WEBHOOK_INBOX", "true");
    expect(intakeConfiguration("website")).toBe("disabled");
    expect(authorizedIntake("website", `Bearer ${"a".repeat(64)}`)).toBe(false);
  });
  it("requires private owner credentials and Cody setup for paid routing", () => {
    configure(); expect(intakeConfiguration("remodel-favor")).toBe("ready");
    vi.stubEnv("CODY_PASSWORD", ""); expect(intakeConfiguration("remodel-favor")).toBe("needs-setup");
    expect(intakeConfiguration("website")).toBe("ready");
    vi.stubEnv("OWNER_PASSWORD", "isolated-legacy-credential"); expect(intakeConfiguration("website")).toBe("needs-setup");
  });
  it("scopes keys to one provider and refuses reused secrets", () => {
    configure(); expect(authorizedIntake("website", `Bearer ${"a".repeat(64)}`)).toBe(true);
    expect(authorizedIntake("remodel-favor", `Bearer ${"a".repeat(64)}`)).toBe(false);
    expect(authorizedIntake("website", null)).toBe(false);
    vi.stubEnv("INTAKE_REMODEL_FAVOR_KEY", "a".repeat(64));
    expect(intakeConfiguration("website")).toBe("needs-setup");
  });
  it("blocks every source when the owner password is shared with Cody", () => {
    configure(); vi.stubEnv("CODY_PASSWORD", "isolated-owner-credential");
    vi.stubEnv("LEAD_INTAKE_SOURCES", "website,remodel-favor,lsa,roofr-instant-estimator,fb-lead");
    vi.stubEnv("INTAKE_LSA_KEY", "c".repeat(64)); vi.stubEnv("INTAKE_ROOFR_KEY", "d".repeat(64));
    vi.stubEnv("INTAKE_FACEBOOK_KEY", "e".repeat(64));
    for (const source of ["website", "remodel-favor", "lsa", "roofr-instant-estimator", "fb-lead"] as const) expect(intakeConfiguration(source)).toBe("needs-setup");
  });
  it("keeps Facebook off until explicitly enabled and isolates its key from website intake", () => {
    configure(); vi.stubEnv("INTAKE_FACEBOOK_KEY", "e".repeat(64));
    expect(intakeConfiguration("fb-lead")).toBe("disabled");
    vi.stubEnv("LEAD_INTAKE_SOURCES", "website,fb-lead");
    expect(authorizedIntake("fb-lead", `Bearer ${"e".repeat(64)}`)).toBe(true);
    expect(authorizedIntake("fb-lead", `Bearer ${"a".repeat(64)}`)).toBe(false);
    expect(authorizedIntake("website", `Bearer ${"e".repeat(64)}`)).toBe(false);
    vi.stubEnv("INTAKE_FACEBOOK_KEY", "a".repeat(64));
    expect(intakeConfiguration("fb-lead")).toBe("needs-setup");
    expect(intakeConfiguration("website")).toBe("needs-setup");
  });
});
describe("ChatGPT Ads intake", () => {
  it("requires explicit enablement and a distinct source credential", () => {
    configure(); vi.stubEnv("INTAKE_CHATGPT_ADS_KEY", "f".repeat(64));
    expect(intakeConfiguration("chatgpt-ads")).toBe("disabled");
    vi.stubEnv("LEAD_INTAKE_SOURCES", "website,chatgpt-ads");
    expect(authorizedIntake("chatgpt-ads", `Bearer ${"f".repeat(64)}`)).toBe(true);
    expect(authorizedIntake("chatgpt-ads", `Bearer ${"a".repeat(64)}`)).toBe(false);
    expect(authorizedIntake("website", `Bearer ${"f".repeat(64)}`)).toBe(false);
    vi.stubEnv("INTAKE_CHATGPT_ADS_KEY", "a".repeat(64));
    expect(intakeConfiguration("chatgpt-ads")).toBe("needs-setup");
    expect(intakeConfiguration("website")).toBe("needs-setup");
  });
  it("requires an actual inquiry and rejects ad or conversation envelopes", () => {
    expect(parseIntakeLead(fixture, "chatgpt-ads").phone).toBe("+19045550100");
    expect(() => parseIntakeLead({ ...fixture, phone: null }, "chatgpt-ads")).toThrow();
    for (const extra of [{ conversation: "private" }, { click_id: "click-1" }, { sourceUrl: "https://chatgpt.com/c/private" }]) {
      expect(() => parseIntakeLead({ ...fixture, ...extra }, "chatgpt-ads")).toThrow();
    }
  });
});
describe("lead-only contract", () => {
  it("normalizes equivalent phone/email/timestamp inputs", () => {
    const a = parseIntakeLead({ ...fixture, email: " TEST@EXAMPLE.INVALID ", receivedAt: "2026-09-22T17:41:00-04:00" }, "website");
    const b = parseIntakeLead({ ...fixture, phone: "+19045550100", email: "test@example.invalid" }, "website");
    expect(a).toEqual(b); expect(a.phone).toBe("+19045550100");
  });
  it("normalizes provider timestamps with microsecond or nanosecond precision", () => {
    for (const receivedAt of ["2026-09-22T21:41:00.123456Z", "2026-09-22T17:41:00.123456789-04:00"]) {
      expect(parseIntakeLead({ ...fixture, receivedAt }, "website").receivedAt).toBe("2026-09-22T21:41:00.123Z");
    }
  });
  it.each(["payload", "headers", "transcript", "attachments", "source", "assignedPm", "stage", "__proto__"])("rejects extra field %s", field => {
    const data = { ...fixture, [field]: "private" };
    expect(() => parseIntakeLead(data, "website")).toThrow(/documented lead fields/);
  });
  it.each([
    { name: "" }, { name: "x".repeat(161) }, { name: { content: "private" } },
    { request: "private\ntranscript" }, { request: "https://drive.google.com/file/secret" },
    { phone: "12345" }, { phone: "9045550100 ext 123" }, { phoneExtension: "not digits" },
    { email: "bad@" }, { recordId: "unstable id /" }, { schemaVersion: 2 },
    { receivedAt: "2026-09-22T17:41:00" }, { receivedAt: "2099-09-22T21:41:00Z" },
    { receivedAt: "2026-02-31T21:41:00Z" },
    { phone: null }, { sourceUrl: "https://drive.google.com/file/123" },
  ])("rejects malformed or out-of-scope lead %#", update => {
    expect(() => parseIntakeLead({ ...fixture, ...update }, "website")).toThrow();
  });
  it("preserves LSA callback extensions and supports a source link without a permanent customer phone", () => {
    const sourceUrl = "https://ads.google.com/localservices/lead?lid=123&cid=456";
    const lsa = parseIntakeLead({ ...fixture, phone: null, sourceUrl }, "lsa");
    expect(lsa.phone).toBeNull(); expect(lsa.sourceUrl).toBe(sourceUrl);
    expect(parseIntakeLead({ ...fixture, phoneExtension: "12345" }, "lsa").phoneExtension).toBe("12345");
    expect(() => parseIntakeLead({ ...fixture, phone: null, sourceUrl }, "website")).toThrow();
    expect(() => parseIntakeLead({ ...fixture, sourceUrl: "https://ads.google.com.evil.example/localservices/lead?lid=123" }, "lsa")).toThrow();
    expect(() => parseIntakeLead({ ...fixture, sourceUrl: `${sourceUrl}&document=private` }, "lsa")).toThrow();
  });
  it("rejects oversized streaming requests without relying on Content-Length", async () => {
    await expect(readIntakeBody(new Request("https://example.invalid", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: "x".repeat(9000) }) }))).rejects.toMatchObject({ status: 413 });
  });
  it("rejects wrong MIME type and malformed JSON", async () => {
    await expect(readIntakeBody(new Request("https://example.invalid", { method: "POST", body: "{}" }))).rejects.toMatchObject({ status: 415 });
    await expect(readIntakeBody(new Request("https://example.invalid", { method: "POST", headers: { "content-type": "application/json" }, body: "{" }))).rejects.toMatchObject({ status: 400 });
  });
});
