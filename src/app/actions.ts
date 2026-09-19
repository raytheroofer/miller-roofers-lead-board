"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { actorFromSession } from "@/lib/session";
import { assignManual, assignRoundRobin } from "@/lib/assign";
import { isLeadSource } from "@/lib/sources";
import { assertTransition, isStage } from "@/lib/stages";
import { isRrPm } from "@/lib/rr";
import { canTransition } from "@/lib/stages";

export async function createLeadAction(formData: FormData) {
  const actor = await actorFromSession();
  const name = String(formData.get("name") ?? "").trim();
  const source = String(formData.get("source") ?? "other");
  if (!name) throw new Error("Name is required");
  if (!isLeadSource(source)) throw new Error("Invalid source");

  const phone = String(formData.get("phone") ?? "").trim();
  const lead = await prisma.lead.create({
    data: {
      name,
      source,
      phones: JSON.stringify(phone ? [phone] : []),
      email: String(formData.get("email") ?? "") || null,
      address: String(formData.get("address") ?? "") || null,
      zip: String(formData.get("zip") ?? "") || null,
      notesSummary: String(formData.get("notesSummary") ?? "") || null,
      insuranceClaim: formData.get("insuranceClaim") === "on",
      insuranceCarrier: String(formData.get("insuranceCarrier") ?? "") || null,
      roofAge: String(formData.get("roofAge") ?? "") || null,
      urgency: String(formData.get("urgency") ?? "") || null,
    },
  });

  await prisma.activity.create({
    data: {
      leadId: lead.id,
      type: "note",
      actor: "human",
      actorName: actor.name,
      summary: "Lead captured",
    },
  });

  redirect(`/leads/${lead.id}`);
}

export async function updateStageAction(formData: FormData) {
  const actor = await actorFromSession();
  const id = String(formData.get("leadId") ?? "");
  const stage = String(formData.get("stage") ?? "");
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) throw new Error("Lead not found");
  if (!isStage(stage)) throw new Error("Invalid stage");
  assertTransition(lead.stage, stage, { allowBackward: actor.allowBackward });

  await prisma.lead.update({
    where: { id },
    data: {
      stage,
      result: stage === "won" ? "won" : stage === "lost_nurture" ? "lost" : lead.result,
      reasonCode: String(formData.get("reasonCode") ?? "") || lead.reasonCode,
    },
  });

  await prisma.activity.create({
    data: {
      leadId: id,
      type: "stage",
      actor: "human",
      actorName: actor.name,
      outcome: stage,
      summary: `Stage ${lead.stage} → ${stage}`,
    },
  });

  revalidatePath("/");
  revalidatePath(`/leads/${id}`);
}

export async function logActivityAction(formData: FormData) {
  const actor = await actorFromSession();
  const id = String(formData.get("leadId") ?? "");
  const type = String(formData.get("type") ?? "note");
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) throw new Error("Lead not found");

  await prisma.activity.create({
    data: {
      leadId: id,
      type,
      direction: String(formData.get("direction") ?? "outbound"),
      actor: "human",
      actorName: actor.name,
      outcome: String(formData.get("outcome") ?? "") || null,
      body: String(formData.get("body") ?? "") || null,
      summary: String(formData.get("summary") ?? "") || `${type} logged (human-entered)`,
    },
  });

  if ((type === "call" || type === "sms") && canTransition(lead.stage, "contact")) {
    await prisma.lead.update({ where: { id }, data: { stage: "contact" } });
  }

  revalidatePath(`/leads/${id}`);
  revalidatePath("/");
}

export async function setAppointmentAction(formData: FormData) {
  const actor = await actorFromSession();
  const id = String(formData.get("leadId") ?? "");
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) throw new Error("Lead not found");
  const startsAt = String(formData.get("startsAt") ?? "");
  if (!startsAt) throw new Error("Start time is required");
  const assignee = String(formData.get("assignee") ?? lead.assignedPm ?? "raymond");
  if (!isRrPm(assignee)) throw new Error("Assignee must be in the RR pool");

  const appointment = await prisma.appointment.create({
    data: {
      leadId: id,
      startsAt: new Date(startsAt),
      endsAt: formData.get("endsAt") ? new Date(String(formData.get("endsAt"))) : null,
      assignee,
      roofrCalendarId: String(formData.get("roofrCalendarId") ?? "") || null,
      status: "set",
      notes: String(formData.get("notes") ?? "") || null,
    },
  });

  await prisma.lead.update({
    where: { id },
    data: {
      assignedPm: assignee,
      nextActionAt: appointment.startsAt,
      stage: canTransition(lead.stage, "appointment_set") ? "appointment_set" : lead.stage,
    },
  });

  await prisma.activity.create({
    data: {
      leadId: id,
      type: "note",
      actor: "human",
      actorName: actor.name,
      outcome: "appointment_set",
      summary:
        "Appointment set (human-entered). Display only — book the slot in Roofr calendar, then paste the Roofr calendar id.",
      body: appointment.roofrCalendarId ?? undefined,
    },
  });

  revalidatePath(`/leads/${id}`);
  revalidatePath("/");
  revalidatePath("/calendar");
}

export async function assignRoundRobinAction(formData: FormData) {
  const actor = await actorFromSession();
  const id = String(formData.get("leadId") ?? "");
  await assignRoundRobin({ leadId: id, actorName: actor.name });
  revalidatePath(`/leads/${id}`);
  revalidatePath("/");
}

export async function assignManualAction(formData: FormData) {
  const actor = await actorFromSession();
  const id = String(formData.get("leadId") ?? "");
  const toPm = String(formData.get("toPm") ?? "");
  await assignManual({
    leadId: id,
    toPm,
    actorName: actor.name,
    reason: leadReason(formData.get("reason")),
  });
  revalidatePath(`/leads/${id}`);
  revalidatePath("/");
}

function leadReason(value: FormDataEntryValue | null): "manual_override" | "reassign" {
  return value === "reassign" ? "reassign" : "manual_override";
}

export async function updateOpportunityAction(formData: FormData) {
  await actorFromSession();
  const id = String(formData.get("leadId") ?? "");
  await prisma.opportunityLink.upsert({
    where: { leadId: id },
    create: {
      leadId: id,
      roofrId: String(formData.get("roofrId") ?? "") || null,
      mrsJobId: String(formData.get("mrsJobId") ?? "") || null,
      companycamRef: String(formData.get("companycamRef") ?? "") || null,
    },
    update: {
      roofrId: String(formData.get("roofrId") ?? "") || null,
      mrsJobId: String(formData.get("mrsJobId") ?? "") || null,
      companycamRef: String(formData.get("companycamRef") ?? "") || null,
    },
  });
  revalidatePath(`/leads/${id}`);
}

export async function updateLeadDetailsAction(formData: FormData) {
  await actorFromSession();
  const id = String(formData.get("leadId") ?? "");
  const phone = String(formData.get("phone") ?? "").trim();
  await prisma.lead.update({
    where: { id },
    data: {
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? "") || null,
      address: String(formData.get("address") ?? "") || null,
      zip: String(formData.get("zip") ?? "") || null,
      phones: JSON.stringify(phone ? [phone] : []),
      insuranceClaim: formData.get("insuranceClaim") === "on",
      insuranceCarrier: String(formData.get("insuranceCarrier") ?? "") || null,
      roofAge: String(formData.get("roofAge") ?? "") || null,
      urgency: String(formData.get("urgency") ?? "") || null,
      notesSummary: String(formData.get("notesSummary") ?? "") || null,
    },
  });
  revalidatePath(`/leads/${id}`);
  revalidatePath("/");
}
