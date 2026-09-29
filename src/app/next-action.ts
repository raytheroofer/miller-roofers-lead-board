"use server";

import { revalidatePath } from "next/cache";
import { actorFromSession } from "@/lib/session";
import { parseEasternInput } from "@/lib/eastern-time";
import { isRrPm } from "@/lib/rr";
import { serialTransaction } from "@/lib/transaction";

export type NextActionState = { error?: string; message?: string };

export async function saveNextAction(_previous: NextActionState, form: FormData): Promise<NextActionState> {
  const actor = await actorFromSession();
  const leadId = String(form.get("leadId") ?? "");
  const summary = String(form.get("summary") ?? "").trim();
  const assignedPm = String(form.get("assignedPm") ?? "");
  if (!summary || summary.length > 500) return { error: "Enter a next action of 1–500 characters." };
  if (!isRrPm(assignedPm)) return { error: "Choose an owner for the action." };
  let due: Date;
  try { due = parseEasternInput(String(form.get("due") ?? "")); }
  catch (error) { return { error: (error as Error).message }; }
  await serialTransaction(async tx => {
    const lead = await tx.lead.findUniqueOrThrow({ where: { id: leadId } });
    await tx.lead.update({ where: { id: leadId }, data: { nextActionAt: due, assignedPm } });
    await tx.activity.create({ data: { leadId, type: "next_action", actor: "human", actorName: actor.name,
      summary, body: `Due ${due.toISOString()}; owner ${assignedPm}`, outcome: "scheduled" } });
    if (lead.assignedPm !== assignedPm) {
      await tx.assignmentEvent.create({ data: { leadId, fromPm: lead.assignedPm, toPm: assignedPm,
        reason: "next_action_owner", actor: actor.name } });
    }
  });
  revalidatePath("/today"); revalidatePath("/"); revalidatePath(`/leads/${leadId}`);
  return { message: "Next action saved. Due time is shown in Eastern Time." };
}

export async function completeNextAction(_previous: NextActionState, form: FormData): Promise<NextActionState> {
  const actor = await actorFromSession();
  const leadId = String(form.get("leadId") ?? "");
  const expectedDue = String(form.get("expectedDue") ?? "");
  const expectedVersion = String(form.get("expectedVersion") ?? "");
  const result = String(form.get("result") ?? "").trim();
  if (!result) return { error: "Record the result before completing this action." };
  const completed = await serialTransaction(async tx => {
    const lead = await tx.lead.findUniqueOrThrow({ where: { id: leadId } });
    if (!lead.nextActionAt || lead.nextActionAt.toISOString() !== expectedDue || lead.updatedAt.toISOString() !== expectedVersion) return false;
    await tx.lead.update({ where: { id: leadId }, data: { nextActionAt: null } });
    await tx.activity.create({ data: { leadId, type: "next_action_completed", actor: "human", actorName: actor.name,
      summary: result, outcome: "completed" } });
    return true;
  });
  if (!completed) return { error: "The action changed or was already completed. Reload before continuing." };
  revalidatePath("/today"); revalidatePath("/"); revalidatePath(`/leads/${leadId}`);
  return { message: "Completed. Set the next action if this lead remains open." };
}
