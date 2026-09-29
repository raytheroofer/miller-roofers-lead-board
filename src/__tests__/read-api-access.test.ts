import { afterEach, describe, expect, it, vi } from "vitest";

const { auth, events, leads } = vi.hoisted(() => ({ auth: vi.fn(), events: vi.fn(), leads: vi.fn() }));
vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  webhookEvent: { findMany: events }, lead: { findMany: leads },
} }));
import { GET as inbox } from "@/app/api/webhooks/route";
import { GET as readLeads } from "@/app/api/leads/route";

afterEach(() => vi.resetAllMocks());

describe("webhook inbox authorization", () => {
  it.each([undefined, { user: { role: "pm" } }, { user: { role: "other" } }])("denies unauthorized readers before fetching payloads: %j", async session => {
    auth.mockResolvedValue(session);
    expect((await inbox()).status).toBe(session ? 403 : 401);
    expect(events).not.toHaveBeenCalled();
  });
  it.each(["owner", "firstmate"])("keeps %s inbox access", async role => {
    auth.mockResolvedValue({ user: { role } });
    events.mockResolvedValue([{ payload: '{"source":"fixture"}', headers: null }]);
    const response = await inbox();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ events: [{ payload: { source: "fixture" }, headers: null }] });
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
