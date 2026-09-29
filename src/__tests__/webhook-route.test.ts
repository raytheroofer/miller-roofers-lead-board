import { afterEach, describe, expect, it, vi } from "vitest";
const create = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: { webhookEvent: { create } } }));
import { POST } from "@/app/api/webhooks/[source]/route";
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
const send = (body: string, headers: Record<string,string> = {}) => POST(new Request("https://example.test/api/webhooks/website", { method: "POST", body, headers: { "content-type": "application/json", ...headers } }), { params: Promise.resolve({ source: "website" }) });
describe("disabled and authenticated webhook boundary", () => {
  it("fails closed when disabled or missing a secret", async () => {
    vi.stubEnv("FEATURE_WEBHOOK_INBOX", "false");
    expect((await send("{}")).status).toBe(503); expect(create).not.toHaveBeenCalled();
    vi.stubEnv("FEATURE_WEBHOOK_INBOX", "true"); vi.stubEnv("WEBHOOK_SECRET", "");
    expect((await send("{}")).status).toBe(503);
  });
  it("rejects malformed JSON without storing a successful event", async () => {
    vi.stubEnv("FEATURE_WEBHOOK_INBOX", "true"); vi.stubEnv("WEBHOOK_SECRET", "test-secret");
    expect((await send("not json", { "x-mrs-webhook-secret": "test-secret" })).status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });
  it("bounds the body before storing it", async () => {
    vi.stubEnv("FEATURE_WEBHOOK_INBOX", "true"); vi.stubEnv("WEBHOOK_SECRET", "test-secret");
    expect((await send(JSON.stringify({ data: "x".repeat(260000) }), { "x-mrs-webhook-secret": "test-secret" })).status).toBe(413);
    expect(create).not.toHaveBeenCalled();
  });
});
