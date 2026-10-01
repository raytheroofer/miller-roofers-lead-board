import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_ASSIGNEES, isAssignablePm, nextAvailableAssignee, pmLabel } from "@/lib/rr";

const state = vi.hoisted(() => ({ actor: { role: "owner", email: "ray@mrsroofers.com", name: "Owner" },
  tx: { user: { findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn(), create: vi.fn(), upsert: vi.fn() },
    roundRobinCursor: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() } } }));
vi.mock("@/lib/session", () => ({ actorFromSession: async () => state.actor }));
vi.mock("@/lib/transaction", () => ({ serialTransaction: (run: (client: typeof state.tx) => unknown) => run(state.tx) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { addAssigneeAction, setPoolMembershipAction } from "@/app/routing/actions";
import { getAssignees, getRoutingDirectory, ASSIGNEE_ROLE } from "@/lib/routing-directory";
import { allowedEmails } from "@/lib/users";

const form = (values: Record<string, string>) => { const data = new FormData(); Object.entries(values).forEach(([k,v]) => data.set(k,v)); return data; };
const id = "00000000-0000-4000-8000-000000000001";
const custom = { slug: `rep_${id}`, name: "SYSTEM CHECK New Assignee", email: "assignee@example.invalid", role: ASSIGNEE_ROLE, inRrPool: true, updatedAt: new Date("2026-10-01T00:00:00Z") };
beforeEach(() => {
  vi.resetAllMocks();
  state.actor = { role: "owner", email: "ray@mrsroofers.com", name: "Owner" };
  vi.stubEnv("OWNER_EMAIL", "ray@mrsroofers.com"); vi.stubEnv("OWNER_ONLY", "true");
  vi.stubEnv("OWNER_PASSWORD", "synthetic-private-owner-pass"); vi.stubEnv("AUTH_PASSWORD", "synthetic-legacy-pass");
  vi.stubEnv("CODY_PASSWORD", "synthetic-cody-pass"); vi.stubEnv("FIRSTMATE_PASSWORD", "");
  state.tx.user.findMany.mockResolvedValue([]); state.tx.user.findUnique.mockResolvedValue(null);
  state.tx.user.count.mockResolvedValue(0); state.tx.roundRobinCursor.findUnique.mockImplementation(async ({ where }) => where.id === "routing-directory-v1" ? { id: where.id } : null);
});
afterEach(() => vi.unstubAllEnvs());

describe("paid-lead directory and turn order", () => {
  it("keeps the current rotation on upgrade until the owner explicitly uses the new controls", async () => {
    state.tx.roundRobinCursor.findUnique.mockResolvedValue(null);
    state.tx.user.findMany.mockResolvedValue(DEFAULT_ASSIGNEES.map(member => ({ ...member, inRrPool: false, role: "pm", updatedAt: new Date() })));
    expect(await getAssignees(state.tx as never)).toEqual(DEFAULT_ASSIGNEES);
    expect(state.tx.user.upsert).not.toHaveBeenCalled(); expect(state.tx.roundRobinCursor.create).not.toHaveBeenCalled();
    expect(await setPoolMembershipAction(form({ slug: "cody", version: "default", enabled: "false" }))).toBeUndefined();
    expect(state.tx.roundRobinCursor.create).toHaveBeenCalledWith({ data: { id: "routing-directory-v1", lastIndex: -1 } });
    expect(state.tx.user.upsert).toHaveBeenLastCalledWith(expect.objectContaining({ where: { slug: "cody" }, update: { inRrPool: false } }));
  });
  it("honors persisted pauses and includes new assignees without leaking their email into staff options", async () => {
    state.tx.user.findMany.mockResolvedValue([{ ...custom, slug: "cody", role: "pm", inRrPool: false }, custom]);
    const roster = await getAssignees(state.tx as never);
    expect(roster.map(member => [member.slug, member.inRrPool])).toEqual([["raymond", true], ["cody", false], [custom.slug, true]]);
    expect(roster.every(member => !Object.hasOwn(member, "email") && !Object.hasOwn(member, "version"))).toBe(true);
    expect(nextAvailableAssignee(0, roster)).toEqual({ pm: custom.slug, nextIndex: 2 });
    expect(nextAvailableAssignee(2, roster)).toEqual({ pm: "raymond", nextIndex: 0 });
    expect(pmLabel(custom.slug, roster)).toBe(custom.name);
  });
  it("retains paused positions so resuming does not reinterpret the cursor", () => {
    const paused = DEFAULT_ASSIGNEES.map(member => ({ ...member, inRrPool: member.slug !== "cody" }));
    expect(nextAvailableAssignee(0, paused)).toEqual({ pm: "raymond", nextIndex: 0 });
    expect(nextAvailableAssignee(0, DEFAULT_ASSIGNEES)).toEqual({ pm: "cody", nextIndex: 1 });
    expect(nextAvailableAssignee(1, paused)).toEqual({ pm: "raymond", nextIndex: 0 });
  });
  it("does not restore Austin or Chris through stored pool flags", async () => {
    state.tx.user.findMany.mockResolvedValue(["austin", "chris", "chris_bell", "chris-bell"].map(slug => ({ ...custom, slug })));
    const roster = await getAssignees(state.tx as never);
    expect(roster).toEqual(DEFAULT_ASSIGNEES);
    expect(isAssignablePm("austin", [{ slug: "austin", name: "Former", inRrPool: true }])).toBe(false);
  });
  it("treats an empty pool as paused while keeping manual assignees available", () => {
    const roster = DEFAULT_ASSIGNEES.map(member => ({ ...member, inRrPool: false }));
    expect(nextAvailableAssignee(0, roster)).toBeNull();
    expect(isAssignablePm("cody", roster)).toBe(true);
    expect(nextAvailableAssignee(-1, [])).toBeNull();
  });
});

describe("owner routing mutations", () => {
  it.each(["pm", "firstmate", "other"])("denies %s before reading or changing the directory", async role => {
    state.actor.role = role;
    expect(await setPoolMembershipAction(form({ slug: "cody", version: "default", enabled: "false" }))).toEqual({ error: "Only the owner can manage lead routing." });
    expect(await addAssigneeAction(form({ captureId: id, name: custom.name, email: custom.email }))).toEqual({ error: "Only the owner can manage lead routing." });
    expect(state.tx.user.findMany).not.toHaveBeenCalled(); expect(state.tx.user.create).not.toHaveBeenCalled();
  });
  it("denies a forged owner role with a different identity", async () => {
    state.actor.email = "cody@mrsroofers.com";
    expect((await setPoolMembershipAction(form({ slug: "cody", version: "default", enabled: "false" })))?.error).toMatch(/Only the owner/);
    expect(state.tx.user.upsert).not.toHaveBeenCalled();
  });
  it.each(["", "short", "synthetic-legacy-pass", "synthetic-cody-pass"])("requires a private owner credential before pool changes (%s)", async password => {
    vi.stubEnv("OWNER_PASSWORD", password);
    expect((await setPoolMembershipAction(form({ slug: "cody", version: "default", enabled: "false" })))?.error).toMatch(/private owner/);
    expect(state.tx.user.upsert).not.toHaveBeenCalled();
  });
  it("changes only future paid-lead membership, without touching profile role or historical leads", async () => {
    expect(await setPoolMembershipAction(form({ slug: "cody", version: "default", enabled: "false" }))).toBeUndefined();
    expect(state.tx.user.upsert).toHaveBeenCalledWith({ where: { slug: "cody" }, update: { inRrPool: false },
      create: { slug: "cody", name: "Cody Boyd", email: "cody@mrsroofers.com", role: "pm", inRrPool: false } });
  });
  it("rejects a stale pool form and an excluded assignee", async () => {
    state.tx.user.findMany.mockResolvedValue([{ ...custom, slug: "cody", role: "pm" }]);
    expect((await setPoolMembershipAction(form({ slug: "cody", version: "default", enabled: "false" })))?.error).toMatch(/pool changed/);
    expect((await setPoolMembershipAction(form({ slug: "austin", version: "default", enabled: "true" })))?.error).toMatch(/directory/);
    expect(state.tx.user.upsert).not.toHaveBeenCalled();
  });
  it("adds an assignee paused by default without changing sign-in access", async () => {
    const before = allowedEmails();
    expect(await addAssigneeAction(form({ captureId: id, name: custom.name, email: custom.email }))).toBeUndefined();
    expect(state.tx.user.create).toHaveBeenCalledWith({ data: { id: `assignee_${id}`, slug: custom.slug, name: custom.name, email: custom.email, role: ASSIGNEE_ROLE, inRrPool: false } });
    expect(allowedEmails()).toEqual(before); expect(allowedEmails()).not.toContain(custom.email);
  });
  it("does not add duplicate profiles on an unchanged repeated submission", async () => {
    state.tx.user.findUnique.mockResolvedValue({ ...custom, id: `assignee_${id}` });
    expect(await addAssigneeAction(form({ captureId: id, name: custom.name, email: custom.email }))).toBeUndefined();
    expect(state.tx.user.create).not.toHaveBeenCalled();
    expect((await addAssigneeAction(form({ captureId: id, name: "Changed", email: custom.email })))?.error).toMatch(/different assignee/);
  });
  it.each(["austin@mrsroofers.com", "chris@mrsroofers.com", "cody@mrsroofers.com"])("rejects recreating reserved staff (%s)", async email => {
    expect((await addAssigneeAction(form({ captureId: id, name: "Someone", email })))?.error).toMatch(/excluded/);
    expect(state.tx.user.create).not.toHaveBeenCalled();
  });
  it("preserves the last person's position when an insertion changes ordering", async () => {
    const later = { ...custom, slug: "rep_later", name: "Later" };
    state.tx.user.findMany.mockResolvedValueOnce([later]).mockResolvedValueOnce([custom, later]);
    state.tx.roundRobinCursor.findUnique.mockResolvedValue({ lastIndex: 2 });
    expect(await addAssigneeAction(form({ captureId: id, name: custom.name, email: custom.email }))).toBeUndefined();
    expect(state.tx.roundRobinCursor.update).toHaveBeenCalledWith({ where: { id: "raymond-cody-v1" }, data: { lastIndex: 3 } });
  });
  it("returns a current version for stored members", async () => {
    state.tx.user.findMany.mockResolvedValue([custom]);
    expect((await getRoutingDirectory(state.tx as never)).find(member => member.slug === custom.slug)?.version).toBe(custom.updatedAt.toISOString());
  });
});
