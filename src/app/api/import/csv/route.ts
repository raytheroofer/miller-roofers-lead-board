import { actorFromSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { parseCsv, rowsToLeads } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const actor = await actorFromSession();
  const form = await request.formData();
  const file = form.get("file");
  const textField = form.get("csv");

  let text = "";
  if (file instanceof File) {
    text = await file.text();
  } else if (typeof textField === "string") {
    text = textField;
  }

  if (!text.trim()) {
    return Response.json({ error: "CSV file or text is required" }, { status: 400 });
  }

  const { leads, errors } = rowsToLeads(parseCsv(text));
  if (leads.length === 0) {
    return Response.json({ error: "No valid rows", errors }, { status: 400 });
  }

  const created = await prisma.$transaction(
    leads.map((row) =>
      prisma.lead.create({
        data: {
          name: row.name,
          phones: JSON.stringify(row.phones),
          email: row.email,
          address: row.address,
          zip: row.zip,
          source: row.source,
          notesSummary: row.notesSummary,
          insuranceClaim: row.insuranceClaim,
          insuranceCarrier: row.insuranceCarrier,
          roofAge: row.roofAge,
          urgency: row.urgency,
          leadLogRowId: row.leadLogRowId,
          stage: "capture",
        },
      }),
    ),
  );

  await prisma.activity.createMany({
    data: created.map((lead) => ({
      leadId: lead.id,
      type: "note",
      actor: "human",
      actorName: actor.name,
      summary: "Imported from CSV (storm / permit list)",
    })),
  });

  return Response.json({
    imported: created.length,
    errors,
    leadIds: created.map((lead) => lead.id),
  });
}
