import { afterEach, beforeEach, expect, it, vi } from "vitest";
const { capture } = vi.hoisted(() => ({ capture: vi.fn() }));
vi.mock("@/lib/intake", () => ({ captureSourceLead: capture }));
import { GET, POST } from "@/app/api/intake/[source]/route";
const fixture = { schemaVersion: 1, recordId: "id-1", name: "SYSTEM CHECK", phone: "9045550100", receivedAt: "2026-09-22T21:41:00Z" };
const ctx = (source = "website") => ({ params: Promise.resolve({ source }) });
const request = (input: unknown = fixture, key = "a".repeat(64)) => new Request("https://example.invalid/api/intake/website", {
  method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` }, body: JSON.stringify(input),
});
beforeEach(() => {
  vi.stubEnv("LEAD_INTAKE_SOURCES", "website"); vi.stubEnv("OWNER_PASSWORD", "isolated-owner-credential");
  vi.stubEnv("INTAKE_WEBSITE_KEY", "a".repeat(64)); vi.stubEnv("INTAKE_REMODEL_FAVOR_KEY", "b".repeat(64));
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
it("has no read path", async () => {
  const res = await GET(); expect(res.status).toBe(404); expect(res.headers.get("cache-control")).toContain("no-store");
});
it("does not read the body until enabled and authenticated", async () => {
  const req = request(); const read = vi.spyOn(req, "body", "get");
  expect((await POST(req, ctx("circleback"))).status).toBe(404);
  expect((await POST(req, ctx("remodel-favor"))).status).toBe(503);
  expect((await POST(request(fixture, "b".repeat(64)), ctx())).status).toBe(401);
  expect(read).not.toHaveBeenCalled(); expect(capture).not.toHaveBeenCalled();
});
it("returns only receipt fields after a successful create or repeat", async () => {
  capture.mockResolvedValueOnce({ leadId: "intake_1", disposition: "created", assignedPm: null });
  const res = await POST(request(), ctx()); expect(res.status).toBe(201);
  expect(await res.json()).toEqual({ leadId: "intake_1", disposition: "created", assignedPm: null });
  capture.mockResolvedValueOnce({ leadId: "intake_1", disposition: "duplicate", assignedPm: null });
  expect((await POST(request(), ctx())).status).toBe(200);
});
it("rejects raw envelopes before persistence and sanitizes database errors", async () => {
  const invalid = await POST(request({ ...fixture, transcript: "PRIVATE SENTINEL" }), ctx());
  expect(invalid.status).toBe(422); expect(await invalid.text()).not.toContain("PRIVATE SENTINEL"); expect(capture).not.toHaveBeenCalled();
  capture.mockRejectedValueOnce(new Error("database password PRIVATE SENTINEL"));
  const failed = await POST(request(), ctx()); expect(failed.status).toBe(503);
  expect(await failed.text()).not.toContain("PRIVATE SENTINEL");
});
it("accepts Facebook through its own authenticated source without accepting raw Meta envelopes", async () => {
  vi.stubEnv("LEAD_INTAKE_SOURCES", "website,fb-lead"); vi.stubEnv("INTAKE_FACEBOOK_KEY", "e".repeat(64));
  expect((await POST(request(fixture), ctx("fb-lead"))).status).toBe(401);
  expect((await POST(request({ ...fixture, field_data: [] }, "e".repeat(64)), ctx("fb-lead"))).status).toBe(422);
  expect(capture).not.toHaveBeenCalled();
  capture.mockResolvedValueOnce({ leadId: "facebook_1", disposition: "created", assignedPm: null });
  const result = await POST(request(fixture, "e".repeat(64)), ctx("fb-lead"));
  expect(result.status).toBe(201);
  expect(capture).toHaveBeenCalledWith("fb-lead", expect.objectContaining({ recordId: fixture.recordId }));
  expect(await result.json()).toEqual({ leadId: "facebook_1", disposition: "created", assignedPm: null });
});
