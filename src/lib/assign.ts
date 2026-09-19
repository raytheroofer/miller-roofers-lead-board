import { prisma } from "@/lib/prisma";
import { assertAssignablePm, nextRoundRobin, type RrPm } from "@/lib/rr";
import { canTransition } from "@/lib/stages";

export async function assignRoundRobin(options: {
  leadId: string;
  actorName: string;
}) {
  const lead = await prisma.lead.findUnique({ where: { id: options.leadId } });
  if (!lead) {
    throw new Error("Lead not found");
  }

  const cursor = await prisma.roundRobinCursor.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", lastIndex: -1 },
  });

  const { pm, nextIndex } = nextRoundRobin(cursor.lastIndex);

  return prisma.$transaction(async (tx) => {
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
        summary: `Round-robin assigned to ${pm} (Raymond → Austin → Cody)`,
      },
    });

    await tx.roundRobinCursor.update({
      where: { id: "default" },
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
}) {
  assertAssignablePm(options.toPm);
  const lead = await prisma.lead.findUnique({ where: { id: options.leadId } });
  if (!lead) {
    throw new Error("Lead not found");
  }

  return prisma.$transaction(async (tx) => {
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
      },
    });

    return { lead: updated, assignedPm: options.toPm as RrPm };
  });
}
