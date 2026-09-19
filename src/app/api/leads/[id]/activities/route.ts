import { actorFromSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canTransition } from "@/lib/stages";

export const dynamic = "force-dynamic";

const ACTIVITY_TYPES = ["call", "sms", "email", "note"] as const;

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
  const type = String(body.type ?? "note");
  if (!ACTIVITY_TYPES.includes(type as (typeof ACTIVITY_TYPES)[number])) {
    return Response.json({ error: "invalid activity type" }, { status: 400 });
  }

  const activity = await prisma.activity.create({
    data: {
      leadId: id,
      type,
      direction: body.direction ? String(body.direction) : type === "note" ? "n/a" : "outbound",
      actor: body.actor === "bot" ? "bot" : "human",
      actorName:
        body.actor === "bot"
          ? String(body.actorName ?? "Named bot (Phase 1 stub)")
          : actor.name,
      outcome: body.outcome ? String(body.outcome) : null,
      body: body.body ? String(body.body) : null,
      summary: body.summary ? String(body.summary) : `${type} logged`,
      occurredAt: body.occurredAt ? new Date(String(body.occurredAt)) : new Date(),
    },
  });

  if (type === "call" || type === "sms") {
    if (canTransition(lead.stage, "contact")) {
      await prisma.lead.update({
        where: { id },
        data: { stage: "contact" },
      });
    }
  }

  return Response.json({ activity }, { status: 201 });
}
