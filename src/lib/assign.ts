import { InputError } from "@/lib/input-error";
import { assertAssignablePm, nextRoundRobin, RR_CURSOR_ID, type RrPm } from "@/lib/rr";
import { canTransition } from "@/lib/stages";
import { serialTransaction } from "@/lib/transaction";

export async function assignRoundRobin(options: {
  leadId: string;
  actorName: string;
}) {
  return serialTransaction(async (tx) => {
    const lead = await tx.lead.findUnique({ where: { id: options.leadId } });
  if (!lead) {
    throw new InputError("Lead not found");
  }
  if (lead.source !== "remodel-favor") throw new InputError("Round-robin is only for Remodel Favor leads. Use manual assignment for this source.");
  if (lead.assignedPm) return { lead, assignedPm: lead.assignedPm, nextIndex: null };

    const cursor = await tx.roundRobinCursor.upsert({
    where: { id: RR_CURSOR_ID },
    update: {},
    create: { id: RR_CURSOR_ID, lastIndex: -1 },
  });

    const { pm, nextIndex } = nextRoundRobin(cursor.lastIndex);

    const updated = await tx.lead.update({
      where: { id: lead.id },
      data: {
        assignedPm: pm,
        stage: canTransition(lead.stage, "assign") ? "assign" : lead.stage,
      },
    });

    await tx.assignmentEvent.create({
      data: {
        leadId: lead.id,
        fromPm: lead.assignedPm,
        toPm: pm,
        reason: "rr_auto",
        actor: options.actorName,
      },
    });

    await tx.activity.create({
      data: {
        leadId: lead.id,
        type: "assign",
        direction: "n/a",
        actor: "human",
        actorName: options.actorName,
        outcome: "assigned",
        summary: `Round-robin assigned to ${pm} (Raymond → Cody)`,
      },
    });

    await tx.roundRobinCursor.update({
      where: { id: RR_CURSOR_ID },
      data: { lastIndex: nextIndex },
    });

    return { lead: updated, assignedPm: pm, nextIndex };
  });
}

export async function assignManual(options: {
  leadId: string;
  toPm: string;
  actorName: string;
  reason: "manual_override" | "reassign";
  reasonNote: string;
}) {
  assertAssignablePm(options.toPm);
  if (!options.reasonNote?.trim()) throw new InputError("Explain the assignment or reassignment.");
  return serialTransaction(async (tx) => {
    const lead = await tx.lead.findUnique({ where: { id: options.leadId } });
  if (!lead) {
    throw new InputError("Lead not found");
  }

    const updated = await tx.lead.update({
      where: { id: lead.id },
      data: {
        assignedPm: options.toPm,
        stage: canTransition(lead.stage, "assign") ? "assign" : lead.stage,
      },
    });

    await tx.assignmentEvent.create({
      data: {
        leadId: lead.id,
        fromPm: lead.assignedPm,
        toPm: options.toPm,
        reason: options.reason,
        actor: options.actorName,
      },
    });

    await tx.activity.create({
      data: {
        leadId: lead.id,
        type: "assign",
        direction: "n/a",
        actor: "human",
        actorName: options.actorName,
        outcome: options.reason,
        summary: `Manual assign ${lead.assignedPm ?? "unassigned"} → ${options.toPm}`,
        body: options.reasonNote.trim(),
      },
    });

    return { lead: updated, assignedPm: options.toPm as RrPm };
  });
}
