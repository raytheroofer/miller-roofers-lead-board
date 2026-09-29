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
import { parseEasternInput } from "@/lib/eastern-time";
import { serialTransaction } from "@/lib/transaction";

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
      activities: { create: { type: "note", actor: "human", actorName: actor.name, summary: "Lead captured" } },
    },
  });

  redirect(`/leads/${lead.id}`);
}

export async function updateStageAction(formData: FormData) {
  const actor = await actorFromSession();
  const id = String(formData.get("leadId") ?? "");
  const stage = String(formData.get("stage") ?? "");
  if (!isStage(stage)) throw new Error("Invalid stage");
  await serialTransaction(async tx => {
    const lead = await tx.lead.findUniqueOrThrow({ where: { id }, include: { opportunity: true } });
    assertTransition(lead.stage, stage, { allowBackward: actor.allowBackward });
    if (stage === "won" && !lead.opportunity?.roofrId) throw new Error("Link the Roofr job before marking this lead won.");
    if (stage === "appointment_set" && !await tx.appointment.findFirst({ where: { leadId: id, roofrCalendarId: { not: null } } })) {
      throw new Error("Log the confirmed Roofr appointment first.");
    }
    const reasonCode = String(formData.get("reasonCode") ?? "").trim() || lead.reasonCode;
    if (stage === "lost_nurture" && !reasonCode) throw new Error("Record the lost or nurture reason.");
    await tx.lead.update({ where: { id }, data: { stage,
      result: stage === "won" ? "won" : stage === "lost_nurture" ? "lost" : null, reasonCode } });
    await tx.activity.create({ data: { leadId: id, type: "stage", actor: "human", actorName: actor.name,
      outcome: stage, summary: `Stage ${lead.stage} → ${stage}` } });
  });
  revalidatePath("/"); revalidatePath("/today"); revalidatePath(`/leads/${id}`);
}

export async function logActivityAction(formData: FormData) {
  const actor = await actorFromSession();
  const id = String(formData.get("leadId") ?? "");
  const type = String(formData.get("type") ?? "note");
  if (!["call", "sms", "email", "note"].includes(type)) throw new Error("Invalid activity type");
  await serialTransaction(async tx => {
    const lead = await tx.lead.findUniqueOrThrow({ where: { id } });
    await tx.activity.create({ data: { leadId: id, type,
      direction: String(formData.get("direction") ?? "outbound"), actor: "human", actorName: actor.name,
      outcome: String(formData.get("outcome") ?? "") || null, body: String(formData.get("body") ?? "") || null,
      summary: String(formData.get("summary") ?? "") || `${type} logged (human-entered)` } });
    if ((type === "call" || type === "sms") && canTransition(lead.stage, "contact")) {
      await tx.lead.update({ where: { id }, data: { stage: "contact" } });
    }
  });
  revalidatePath(`/leads/${id}`); revalidatePath("/"); revalidatePath("/today");
}

export async function setAppointmentAction(formData: FormData) {
  const actor = await actorFromSession();
  const id = String(formData.get("leadId") ?? "");
  const roofrCalendarId = String(formData.get("roofrCalendarId") ?? "").trim();
  if (!roofrCalendarId) throw new Error("Book in Roofr first and enter the confirmed appointment reference.");
  const startsAt = parseEasternInput(String(formData.get("startsAt") ?? ""));
  const endsAt = formData.get("endsAt") ? parseEasternInput(String(formData.get("endsAt"))) : null;
  if (endsAt && endsAt <= startsAt) throw new Error("End time must follow the start time.");
  const assignee = String(formData.get("assignee") ?? "");
  if (!isRrPm(assignee)) throw new Error("Choose an assigned PM.");
  await serialTransaction(async tx => {
    const lead = await tx.lead.findUniqueOrThrow({ where: { id } });
    const existing = await tx.appointment.findFirst({ where: { leadId: id, roofrCalendarId } });
    if (existing) return;
    await tx.appointment.create({ data: { leadId: id, startsAt, endsAt, assignee, roofrCalendarId,
      status: "set", notes: String(formData.get("notes") ?? "") || null } });
    await tx.lead.update({ where: { id }, data: {
      assignedPm: assignee, nextActionAt: startsAt,
      stage: canTransition(lead.stage, "appointment_set") ? "appointment_set" : lead.stage,
    } });
    await tx.activity.create({ data: { leadId: id, type: "next_action", actor: "human", actorName: actor.name,
      outcome: "appointment_set", summary: "Attend the confirmed Roofr appointment",
      body: `Roofr reference: ${roofrCalendarId}; starts ${startsAt.toISOString()}; owner ${assignee}` } });
    if (lead.assignedPm !== assignee) await tx.assignmentEvent.create({ data: { leadId: id,
      fromPm: lead.assignedPm, toPm: assignee, reason: "confirmed_appointment_owner", actor: actor.name } });
  });
  revalidatePath(`/leads/${id}`); revalidatePath("/"); revalidatePath("/today"); revalidatePath("/calendar");
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
    reasonNote: String(formData.get("reasonNote") ?? ""),
  });
  revalidatePath(`/leads/${id}`);
  revalidatePath("/");
}

function leadReason(value: FormDataEntryValue | null): "manual_override" | "reassign" {
  return value === "reassign" ? "reassign" : "manual_override";
}

export async function updateOpportunityAction(formData: FormData) {
  const actor = await actorFromSession();
  const id = String(formData.get("leadId") ?? "");
  const roofrId = String(formData.get("roofrId") ?? "").trim() || null;
  const companycamRef = String(formData.get("companycamRef") ?? "").trim() || null;
  if (roofrId && !/^\d+$/.test(roofrId)) throw new Error("Use the numeric Roofr job number.");
  if (companycamRef && !/^https:\/\/app\.companycam\.com\/projects\/\d+\/?$/.test(companycamRef)) {
    throw new Error("Use the CompanyCam project URL from app.companycam.com/projects/…");
  }
  await serialTransaction(async tx => {
    if (roofrId && await tx.opportunityLink.findFirst({ where: { roofrId, leadId: { not: id } } })) {
      throw new Error("That Roofr job is already linked to another lead. Review the existing record first.");
    }
    await tx.opportunityLink.upsert({ where: { leadId: id },
      create: { leadId: id, roofrId, companycamRef }, update: { roofrId, companycamRef } });
    await tx.activity.create({ data: { leadId: id, type: "note", actor: "human", actorName: actor.name,
      summary: "Job links verified and updated manually", body: `Roofr: ${roofrId ?? "none"}; CompanyCam: ${companycamRef ?? "none"}` } });
  });
  revalidatePath(`/leads/${id}`); revalidatePath("/today");
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
