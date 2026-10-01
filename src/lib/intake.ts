import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { INTAKE_SOURCES, type IntakeSource } from "@/lib/intake-config";
import { IntakeError, type IntakeLead } from "@/lib/intake-contract";
import { serialTransaction } from "@/lib/transaction";
import { assignRoundRobinInTransaction } from "@/lib/assign";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export const INTAKE_RECEIPT_TYPE = "source_received";

// Existing primary keys provide durable idempotency without a live schema migration.
// The immutable receipt compares the original normalized input, never the editable lead.
export async function captureSourceLead(source: IntakeSource, input: IntakeLead) {
  const id = `intake_${hash(`${source}\0${input.recordId}`)}`;
  const receiptId = `receipt_${id}`;
  const fingerprint = hash(JSON.stringify(input));
  const definition = INTAKE_SOURCES[source];
  for (let attempt = 0; ; attempt++) {
    try {
      return await serialTransaction(async tx => {
        const receipt = await tx.activity.findUnique({ where: { id: receiptId }, include: { lead: true } });
        if (receipt) {
          const stored = JSON.parse(receipt.body ?? "{}");
          if (receipt.type !== INTAKE_RECEIPT_TYPE || stored.fingerprint !== fingerprint) throw new IntakeError(409, "record_changed", "This provider ID was already received with different details. Review the existing lead; do not retry with a new ID.");
          return { leadId: receipt.leadId, disposition: "duplicate" as const, assignedPm: receipt.lead.assignedPm };
        }
        const now = new Date();
        await tx.lead.create({ data: {
          id, source: definition.source, name: input.name,
          phones: JSON.stringify(input.phone ? [`${input.phone}${input.phoneExtension ? ` ext ${input.phoneExtension}` : ""}`] : []),
          email: input.email, address: input.address, zip: input.zip, notesSummary: input.request,
          nextActionAt: now,
        } });
        await tx.activity.create({ data: {
          id: receiptId, leadId: id, type: INTAKE_RECEIPT_TYPE, actor: "system", actorName: definition.label,
          outcome: "accepted", summary: `${definition.label} lead received · Provider ID ${input.recordId}`,
          body: JSON.stringify({ schemaVersion: 1, source, recordId: input.recordId, receivedAt: input.receivedAt, fingerprint, sourceUrl: input.sourceUrl }),
          occurredAt: now,
        } });
        const assignedPm = definition.routing === "round-robin"
          ? (await assignRoundRobinInTransaction(tx, { leadId: id, actorName: definition.label, actor: "system" })).assignedPm
          : null;
        await tx.activity.create({ data: {
          leadId: id, type: "next_action", actor: "system", actorName: definition.label, outcome: "scheduled",
          summary: assignedPm ? "Review the new lead and make the first follow-up" : "Assign an owner and review the new lead",
          body: source === "lsa" ? "Verify the original Google LSA lead and its callback number and extension before contacting the customer." : "Search for an existing customer or lead before contacting. No message has been sent.",
          occurredAt: now,
        } });
        return { leadId: id, disposition: "created" as const, assignedPm };
      });
    } catch (error) {
      // A concurrent delivery may win the primary-key race; retry to read its receipt.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002" || attempt >= 2) throw error;
    }
  }
}
