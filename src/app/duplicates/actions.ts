"use server";

import { revalidatePath } from "next/cache";
import { actorFromSession } from "@/lib/session";
import { InputError, runFormAction } from "@/lib/input-error";
import { serialTransaction } from "@/lib/transaction";
import { DUPLICATE_LEAD_SELECT } from "@/lib/duplicate-directory";
import { DUPLICATE_REVIEW_TYPE, duplicatePair, isDuplicateDecision, reviewForPair } from "@/lib/duplicate-review";
import { isDemoLead } from "@/lib/demo-data";
import { Prisma } from "@prisma/client";

export async function saveDuplicateReviewAction(form: FormData) {
  return runFormAction(async () => {
    const actor = await actorFromSession();
    const firstId = String(form.get("firstId") ?? ""), secondId = String(form.get("secondId") ?? "");
    const captureId = String(form.get("captureId") ?? "");
    const decision = String(form.get("decision") ?? "");
    const note = String(form.get("note") ?? "").trim();
    if (!firstId || !secondId || firstId >= secondId || firstId.length > 128 || secondId.length > 128) throw new InputError("Reload the duplicate review before saving.");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(captureId)) throw new InputError("Reload the duplicate review before saving.");
    if (!isDuplicateDecision(decision)) throw new InputError("Choose a review outcome.");
    if (note.length < 5 || note.length > 500) throw new InputError("Explain the review in 5–500 characters.");
    for (let attempt = 0; ; attempt++) {
      try {
        await serialTransaction(async tx => {
          const leads = await tx.lead.findMany({ where: { id: { in: [firstId, secondId] } }, select: DUPLICATE_LEAD_SELECT });
          const first = leads.find(lead => lead.id === firstId), second = leads.find(lead => lead.id === secondId);
          if (!first || !second || isDemoLead(first) !== isDemoLead(second)) throw new InputError("Choose two records from the same working or demo view.");
          const pair = duplicatePair(first, second);
          if (!pair) throw new InputError("These records no longer share a matching contact or address. Reload the review.");
          const body = JSON.stringify({ version: 1, pairKey: pair.key, otherLeadId: secondId, fingerprint: pair.fingerprint, note });
          const eventId = `duplicate_review_${captureId}`;
          const existing = await tx.activity.findUnique({ where: { id: eventId } });
          if (existing) {
            if (existing.leadId === firstId && existing.type === DUPLICATE_REVIEW_TYPE && existing.body === body
              && existing.outcome === decision && existing.actorName === actor.email) return;
            throw new InputError("That submission already saved a different review. Reload before trying again.");
          }
          if (first.updatedAt.toISOString() !== form.get("firstVersion") || second.updatedAt.toISOString() !== form.get("secondVersion")) throw new InputError("A lead changed. Reload both records before saving the review.");
          const reviews = await tx.activity.findMany({ where: { leadId: firstId, type: DUPLICATE_REVIEW_TYPE }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
          const current = reviewForPair(pair, reviews);
          if ((current.latest?.id ?? "") !== String(form.get("reviewVersion") ?? "")) throw new InputError("Another review was saved. Reload before changing its outcome.");
          const savedAt = new Date(Math.max(Date.now(), (current.latest?.createdAt.getTime() ?? 0) + 1));
          await tx.activity.create({ data: { id: eventId, leadId: firstId, type: DUPLICATE_REVIEW_TYPE,
            actor: "human", actorName: actor.email, outcome: decision, body,
            createdAt: savedAt, occurredAt: savedAt,
            summary: `${decision === "related" ? "Related inquiry" : decision === "separate" ? "Separate inquiries" : "Duplicate review reopened"}: ${first.name} / ${second.name}` } });
        });
        break;
      } catch (error) {
        // A simultaneous copy can win the review-ID insertion. Read it again
        // in a fresh transaction so an unchanged retry returns its saved result.
        if (error instanceof InputError) throw error;
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && attempt < 2) continue;
        console.error("duplicate_review_unconfirmed", { code: "retry_same_submission" });
        throw new InputError("The review was not confirmed. Reload the review to check its status before trying again.");
      }
    }
    revalidatePath("/duplicates"); revalidatePath("/today");
    revalidatePath(`/leads/${firstId}`); revalidatePath(`/leads/${secondId}`);
  });
}
