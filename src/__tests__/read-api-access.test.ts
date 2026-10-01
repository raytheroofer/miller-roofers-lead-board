import { afterEach, describe, expect, it, vi } from "vitest";

const { auth, events, leads } = vi.hoisted(() => ({ auth: vi.fn(), events: vi.fn(), leads: vi.fn() }));
vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  webhookEvent: { findMany: events }, lead: { findMany: leads },
} }));
import { GET as inbox } from "@/app/api/webhooks/route";
import { GET as readLeads } from "@/app/api/leads/route";

afterEach(() => vi.resetAllMocks());

describe("retired webhook inbox", () => {
  it.each([undefined, { user: { role: "pm" } }, { user: { role: "other" } }, { user: { role: "owner" } }, { user: { role: "firstmate" } }])("exposes no historical payloads to %j", async session => {
    auth.mockResolvedValue(session);
    const response = await inbox();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(events).not.toHaveBeenCalled();
  });
});

describe("historical lead reads", () => {
  it.each(["austin", "raymond", "cody", "unassigned"])("honors the %s filter", async pm => {
    auth.mockResolvedValue({ user: { role: "owner" } });
    leads.mockResolvedValue([]);
    const response = await readLeads(new Request(`https://example.test/api/leads?pm=${pm}`));
    expect(response.status).toBe(200);
    expect(leads).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ assignedPm: pm === "unassigned" ? null : pm }) }));
  });
  it("keeps anonymous lead reads denied", async () => {
    auth.mockResolvedValue(null);
    expect((await readLeads(new Request("https://example.test/api/leads?pm=austin"))).status).toBe(401);
    expect(leads).not.toHaveBeenCalled();
  });
});
