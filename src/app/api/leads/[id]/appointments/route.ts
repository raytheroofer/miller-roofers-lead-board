import { actorFromSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isRrPm } from "@/lib/rr";
import { canTransition } from "@/lib/stages";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const actor = await actorFromSession();
  const { id } = await context.params;
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  if (!body.startsAt) {
    return Response.json({ error: "startsAt is required" }, { status: 400 });
  }

  const assignee = String(body.assignee ?? lead.assignedPm ?? "");
  if (assignee && !isRrPm(assignee)) {
    return Response.json(
      { error: "Appointment assignee must be Raymond, Austin, or Cody" },
      { status: 400 },
    );
  }

  const appointment = await prisma.appointment.create({
    data: {
      leadId: id,
      startsAt: new Date(String(body.startsAt)),
      endsAt: body.endsAt ? new Date(String(body.endsAt)) : null,
      assignee: assignee || "raymond",
      roofrCalendarId: body.roofrCalendarId ? String(body.roofrCalendarId) : null,
      status: body.status ? String(body.status) : "set",
      notes: body.notes ? String(body.notes) : null,
    },
  });

  const nextStage = canTransition(lead.stage, "appointment_set")
    ? "appointment_set"
    : lead.stage;

  await prisma.lead.update({
    where: { id },
    data: {
      stage: nextStage,
      assignedPm: assignee || lead.assignedPm,
      nextActionAt: appointment.startsAt,
    },
  });

  await prisma.activity.create({
    data: {
      leadId: id,
      type: "note",
      actor: "human",
      actorName: actor.name,
      outcome: "appointment_set",
      summary: `Appointment set (human-entered). Calendar SoR = Roofr calendar — display only, no write.`,
      body: appointment.roofrCalendarId
        ? `Roofr calendar id ${appointment.roofrCalendarId}`
        : "No Roofr calendar id yet. Book in Roofr, then paste the id.",
    },
  });

  return Response.json(
    {
      appointment,
      calendarWrite: false,
      sourceOfTruth: "roofr",
    },
    { status: 201 },
  );
}
