import { afterEach, describe, expect, it, vi } from "vitest";
const { create, findMany } = vi.hoisted(() => ({ create: vi.fn(), findMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { webhookEvent: { create, findMany } } }));
import { GET, POST } from "@/app/api/webhooks/[source]/route";
afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });

describe("retired generic webhook boundary", () => {
  it.each(["false", "true"])("rejects intake even with legacy enabled=%s and a configured secret", async enabled => {
    vi.stubEnv("FEATURE_WEBHOOK_INBOX", enabled);
    vi.stubEnv("WEBHOOK_SECRET", "unused-old-secret");
    const response = await POST();
    expect(response.status).toBe(410);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(create).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });
  it("does not disclose integration configuration or payloads through GET", async () => {
    const response = await GET();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
    expect(create).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });
});
