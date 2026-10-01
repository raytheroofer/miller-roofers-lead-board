import { InputError } from "@/lib/input-error";
import { isAssignablePm, nextAvailableAssignee, RR_CURSOR_ID } from "@/lib/rr";
import { getAssignees } from "@/lib/routing-directory";
import { canTransition } from "@/lib/stages";
import { serialTransaction } from "@/lib/transaction";
import type { Prisma } from "@prisma/client";

export async function assignRoundRobin(options: {
  leadId: string;
  actorName: string;
}) {
  const result = await serialTransaction(tx => assignRoundRobinInTransaction(tx, options));
  if (!result.assignedPm) throw new InputError("The paid-lead pool is paused. Assign this lead manually or enable an assignee in Lead routing.");
  return result;
}

export async function assignRoundRobinInTransaction(tx: Prisma.TransactionClient, options: {
  leadId: string; actorName: string; actor?: "human" | "system";
}) {
  const lead = await tx.lead.findUnique({ where: { id: options.leadId } });
  if (!lead) throw new InputError("Lead not found");
  if (lead.source !== "remodel-favor") throw new InputError("Round-robin is only for Remodel Favor leads. Use manual assignment for this source.");
  if (lead.assignedPm) return { lead, assignedPm: lead.assignedPm, nextIndex: null };

  const roster = await getAssignees(tx);
  if (!roster.some(member => member.inRrPool)) return { lead, assignedPm: null, nextIndex: null };
  const cursor = await tx.roundRobinCursor.upsert({
    where: { id: RR_CURSOR_ID }, update: {}, create: { id: RR_CURSOR_ID, lastIndex: -1 },
  });
  const step = nextAvailableAssignee(cursor.lastIndex, roster);
  if (!step) return { lead, assignedPm: null, nextIndex: null };
  const { pm, nextIndex } = step;
  const updated = await tx.lead.update({
    where: { id: lead.id },
    data: { assignedPm: pm, stage: canTransition(lead.stage, "assign") ? "assign" : lead.stage },
  });
  await tx.assignmentEvent.create({ data: {
    leadId: lead.id, fromPm: lead.assignedPm, toPm: pm, reason: "rr_auto", actor: options.actorName,
  } });
  await tx.activity.create({ data: {
    leadId: lead.id, type: "assign", direction: "n/a", actor: options.actor ?? "human",
    actorName: options.actorName, outcome: "assigned", summary: `Paid-lead rotation assigned to ${roster.find(member => member.slug === pm)!.name}`,
  } });
  await tx.roundRobinCursor.update({ where: { id: RR_CURSOR_ID }, data: { lastIndex: nextIndex } });
  return { lead: updated, assignedPm: pm, nextIndex };
}

export async function assignManual(options: {
  leadId: string;
  toPm: string;
  actorName: string;
  reason: "manual_override" | "reassign";
  reasonNote: string;
}) {
  if (!options.reasonNote?.trim()) throw new InputError("Explain the assignment or reassignment.");
  return serialTransaction(async (tx) => {
    if (!isAssignablePm(options.toPm, await getAssignees(tx))) throw new InputError("Choose an assignee from the current directory.");
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

    return { lead: updated, assignedPm: options.toPm };
  });
}
