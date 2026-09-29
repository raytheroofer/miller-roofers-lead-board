import { beforeEach, describe, expect, it, vi } from "vitest";
const tx = vi.hoisted(() => ({ lead: { findUniqueOrThrow: vi.fn(), update: vi.fn() }, activity: { create: vi.fn() }, assignmentEvent: { create: vi.fn() } }));
vi.mock("@/lib/transaction", () => ({ serialTransaction: (run: (client: typeof tx) => unknown) => run(tx) }));
vi.mock("@/lib/session", () => ({ actorFromSession: async () => ({ name: "Owner" }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { saveNextAction, completeNextAction } from "@/app/next-action";
const form = (values: Record<string, string>) => { const data = new FormData(); Object.entries(values).forEach(([k,v]) => data.set(k,v)); return data; };
beforeEach(() => vi.clearAllMocks());
describe("owner action workflow", () => {
  it("rejects an action without a valid due time before writing anything", async () => {
    const result = await saveNextAction({}, form({ leadId: "x", summary: "Call back", assignedPm: "raymond", due: "" }));
    expect(result.error).toBeTruthy(); expect(tx.lead.update).not.toHaveBeenCalled();
  });
  it("saves the Eastern due time, owner and historical action together", async () => {
    tx.lead.findUniqueOrThrow.mockResolvedValue({ assignedPm: null });
    const result = await saveNextAction({}, form({ leadId: "x", summary: "Call back", assignedPm: "raymond", due: "2026-09-30T08:00" }));
    expect(result.message).toMatch(/saved/);
    expect(tx.lead.update).toHaveBeenCalledWith({ where: { id: "x" }, data: { assignedPm: "raymond", nextActionAt: new Date("2026-09-30T12:00:00Z") } });
    expect(tx.activity.create).toHaveBeenCalledOnce(); expect(tx.assignmentEvent.create).toHaveBeenCalledOnce();
  });
  it("does not complete a newer action from a stale form even when the due time is unchanged", async () => {
    tx.lead.findUniqueOrThrow.mockResolvedValue({ nextActionAt: new Date("2026-09-30T12:00:00Z"), updatedAt: new Date("2026-09-29T10:01:00Z") });
    const result = await completeNextAction({}, form({ leadId: "x", result: "Done", expectedDue: "2026-09-30T12:00:00.000Z", expectedVersion: "2026-09-29T10:00:00.000Z" }));
    expect(result.error).toMatch(/changed/); expect(tx.lead.update).not.toHaveBeenCalled();
  });
  it("records completion once and clears the active due time", async () => {
    const version = "2026-09-29T10:00:00.000Z", due = "2026-09-30T12:00:00.000Z";
    tx.lead.findUniqueOrThrow.mockResolvedValue({ nextActionAt: new Date(due), updatedAt: new Date(version) });
    const result = await completeNextAction({}, form({ leadId: "x", result: "Confirmed", expectedDue: due, expectedVersion: version }));
    expect(result.message).toMatch(/Completed/);
    expect(tx.lead.update).toHaveBeenCalledWith({ where: { id: "x" }, data: { nextActionAt: null } });
    expect(tx.activity.create).toHaveBeenCalledOnce();
  });
});
