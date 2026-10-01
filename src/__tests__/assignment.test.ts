import { beforeEach, describe, expect, it, vi } from "vitest";
const tx = vi.hoisted(() => ({ user: { findMany: vi.fn() }, lead: { findUnique: vi.fn(), update: vi.fn() },
  roundRobinCursor: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() }, assignmentEvent: { create: vi.fn() }, activity: { create: vi.fn() } }));
vi.mock("@/lib/transaction", () => ({ serialTransaction: (run: (client: typeof tx) => unknown) => run(tx) }));
import { RR_CURSOR_ID } from "@/lib/rr";
import { assignRoundRobin, assignRoundRobinInTransaction, assignManual } from "@/lib/assign";

beforeEach(() => { vi.clearAllMocks(); tx.user.findMany.mockResolvedValue([]); tx.roundRobinCursor.findUnique.mockResolvedValue({ id: "routing-directory-v1" }); });
describe("routing service", () => {
  it("refuses round-robin on a website lead without advancing the cursor", async () => {
    tx.lead.findUnique.mockResolvedValue({ id: "lead", source: "website", assignedPm: null, stage: "capture" });
    await expect(assignRoundRobin({ leadId: "lead", actorName: "Owner" })).rejects.toThrow(/only for Remodel Favor/);
    expect(tx.roundRobinCursor.upsert).not.toHaveBeenCalled(); expect(tx.lead.update).not.toHaveBeenCalled();
  });
  it("does not reassign a previously assigned lead when a request repeats", async () => {
    tx.lead.findUnique.mockResolvedValue({ id: "lead", source: "remodel-favor", assignedPm: "austin", stage: "assign" });
    const result = await assignRoundRobin({ leadId: "lead", actorName: "Owner" });
    expect(result.assignedPm).toBe("austin"); expect(tx.roundRobinCursor.upsert).not.toHaveBeenCalled();
  });
  it("assigns an eligible lead and writes assignment, activity and cursor together", async () => {
    tx.lead.findUnique.mockResolvedValue({ id: "lead", source: "remodel-favor", assignedPm: null, stage: "capture" });
    tx.roundRobinCursor.upsert.mockResolvedValue({ lastIndex: 0 });
    tx.lead.update.mockResolvedValue({ id: "lead", assignedPm: "cody" });
    expect((await assignRoundRobin({ leadId: "lead", actorName: "Owner" })).assignedPm).toBe("cody");
    expect(tx.assignmentEvent.create).toHaveBeenCalledOnce(); expect(tx.activity.create).toHaveBeenCalledOnce();
    expect(tx.roundRobinCursor.update).toHaveBeenCalledWith({ where: { id: RR_CURSOR_ID }, data: { lastIndex: 1 } });
  });
  it("requires an explanation for manual routing", async () => {
    await expect(assignManual({ leadId: "lead", toPm: "raymond", actorName: "Owner", reason: "manual_override", reasonNote: " " })).rejects.toThrow(/Explain/);
    expect(tx.lead.findUnique).not.toHaveBeenCalled();
  });
  it("queues a paid intake when all members are paused without consuming a turn", async () => {
    tx.user.findMany.mockResolvedValue(["raymond", "cody"].map(slug => ({ slug, inRrPool: false, updatedAt: new Date(), role: "pm" })));
    tx.lead.findUnique.mockResolvedValue({ id: "lead", source: "remodel-favor", assignedPm: null, stage: "capture" });
    expect((await assignRoundRobinInTransaction(tx as never, { leadId: "lead", actorName: "Provider" })).assignedPm).toBeNull();
    expect(tx.roundRobinCursor.upsert).not.toHaveBeenCalled(); expect(tx.lead.update).not.toHaveBeenCalled();
    await expect(assignRoundRobin({ leadId: "lead", actorName: "Owner" })).rejects.toThrow(/paused/);
  });
  it("rejects a fabricated assignee before changing a lead", async () => {
    await expect(assignManual({ leadId: "lead", toPm: "rep_forged", actorName: "Owner", reason: "reassign", reasonNote: "Test" })).rejects.toThrow(/directory/);
    expect(tx.lead.update).not.toHaveBeenCalled();
  });
});
