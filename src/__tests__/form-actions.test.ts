import { beforeEach, describe, expect, it, vi } from "vitest";
const tx = vi.hoisted(() => ({ lead: { findUniqueOrThrow: vi.fn(), update: vi.fn() }, activity: { create: vi.fn() },
  opportunityLink: { findUnique: vi.fn(), findFirst: vi.fn(), upsert: vi.fn() },
  appointment: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() }, assignmentEvent: { create: vi.fn() } }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/transaction", () => ({ serialTransaction: (run: (client: typeof tx) => unknown) => run(tx) }));
vi.mock("@/lib/session", () => ({ actorFromSession: async () => ({ name: "Owner", allowBackward: true }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { updateOpportunityAction, updateStageAction, setAppointmentAction } from "@/app/actions";
import { InputError, runFormAction } from "@/lib/input-error";
const form = (values: Record<string, string>) => { const data = new FormData(); Object.entries(values).forEach(([k,v]) => data.set(k,v)); return data; };
beforeEach(() => vi.resetAllMocks());

describe("action feedback and existing records", () => {
  it("allows correcting CompanyCam without rewriting a legacy Roofr identifier", async () => {
    tx.opportunityLink.findUnique.mockResolvedValue({ roofrId: "RF-88421" });
    tx.opportunityLink.findFirst.mockResolvedValue(null);
    const result = await updateOpportunityAction(form({ leadId: "x", roofrId: "RF-88421", companycamRef: "https://app.companycam.com/projects/123" }));
    expect(result).toBeUndefined(); expect(tx.opportunityLink.upsert).toHaveBeenCalledOnce();
    expect(tx.opportunityLink.upsert.mock.calls[0][0].update).not.toHaveProperty("mrsJobId");
  });
  it("returns a readable validation error when entering a new nonnumeric job ID", async () => {
    tx.opportunityLink.findUnique.mockResolvedValue({ roofrId: "123" });
    const result = await updateOpportunityAction(form({ leadId: "x", roofrId: "MRS-NEW" }));
    expect(result).toEqual({ error: "Use the numeric Roofr job number when changing the job link." });
    expect(tx.opportunityLink.upsert).not.toHaveBeenCalled();
  });
  it("explains why a lead cannot be marked won", async () => {
    tx.lead.findUniqueOrThrow.mockResolvedValue({ stage: "proposal", opportunity: null });
    expect(await updateStageAction(form({ leadId: "x", stage: "won" }))).toEqual({ error: "Link the Roofr job before marking this lead won." });
    expect(tx.lead.update).not.toHaveBeenCalled();
  });
  it("updates a corrected appointment using the same Roofr reference", async () => {
    tx.lead.findUniqueOrThrow.mockResolvedValue({ stage: "appointment_set", assignedPm: "raymond" });
    tx.appointment.findFirst.mockResolvedValue({ id: "appointment", startsAt: new Date("2026-09-30T12:00:00Z"), endsAt: null, assignee: "raymond", notes: null });
    expect(await setAppointmentAction(form({ leadId: "x", roofrCalendarId: "confirmed-ref", startsAt: "2026-09-30T10:00", assignee: "raymond" }))).toBeUndefined();
    expect(tx.appointment.create).not.toHaveBeenCalled();
    expect(tx.appointment.update.mock.calls[0][0].data.startsAt.toISOString()).toBe("2026-09-30T14:00:00.000Z");
    expect(tx.lead.update.mock.calls[0][0].data.nextActionAt.toISOString()).toBe("2026-09-30T14:00:00.000Z");
  });
  it("returns expected input errors but does not reveal internal failures as user messages", async () => {
    expect(await runFormAction(async () => { throw new InputError("Correct the job ID"); })).toEqual({ error: "Correct the job ID" });
    await expect(runFormAction(async () => { throw new Error("Internal failure"); })).rejects.toThrow("Internal failure");
  });
});
