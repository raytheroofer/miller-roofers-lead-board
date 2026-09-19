import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { actorFromSession } from "@/lib/session";
import { isStage } from "@/lib/stages";
import { assertTransition } from "@/lib/stages";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      activities: { orderBy: { occurredAt: "desc" } },
      appointments: { orderBy: { startsAt: "desc" } },
      assignments: { orderBy: { occurredAt: "desc" } },
      opportunity: true,
    },
  });

  if (!lead) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ lead });
}

export async function PATCH(
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
  const data: Record<string, unknown> = {};

  if (typeof body.name === "string") data.name = body.name.trim();
  if (typeof body.email === "string") data.email = body.email || null;
  if (typeof body.address === "string") data.address = body.address || null;
  if (typeof body.zip === "string") data.zip = body.zip || null;
  if (typeof body.notesSummary === "string") data.notesSummary = body.notesSummary || null;
  if (typeof body.insuranceClaim === "boolean") data.insuranceClaim = body.insuranceClaim;
  if (typeof body.insuranceCarrier === "string") data.insuranceCarrier = body.insuranceCarrier || null;
  if (typeof body.roofAge === "string") data.roofAge = body.roofAge || null;
  if (typeof body.urgency === "string") data.urgency = body.urgency || null;
  if (typeof body.nextActionAt === "string") {
    data.nextActionAt = body.nextActionAt ? new Date(body.nextActionAt) : null;
  }
  if (Array.isArray(body.phones)) {
    data.phones = JSON.stringify(body.phones.map(String));
  }
  if (typeof body.stage === "string") {
    if (!isStage(body.stage)) {
      return Response.json({ error: "invalid stage" }, { status: 400 });
    }
    try {
      assertTransition(lead.stage, body.stage, { allowBackward: actor.allowBackward });
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "Illegal stage transition" },
        { status: 400 },
      );
    }
    data.stage = body.stage;
    if (body.stage === "won") data.result = "won";
    if (body.stage === "lost_nurture") data.result = (body.result as string) || "lost";
    if (typeof body.reasonCode === "string") data.reasonCode = body.reasonCode;
  }

  const updated = await prisma.lead.update({ where: { id }, data });

  if (typeof body.stage === "string" && body.stage !== lead.stage) {
    await prisma.activity.create({
      data: {
        leadId: id,
        type: "stage",
        actor: "human",
        actorName: actor.name,
        outcome: String(body.stage),
        summary: `Stage ${lead.stage} → ${body.stage}`,
      },
    });
  }

  if (body.opportunity && typeof body.opportunity === "object") {
    const opp = body.opportunity as Record<string, unknown>;
    await prisma.opportunityLink.upsert({
      where: { leadId: id },
      create: {
        leadId: id,
        roofrId: opp.roofrId ? String(opp.roofrId) : null,
        mrsJobId: opp.mrsJobId ? String(opp.mrsJobId) : null,
        companycamRef: opp.companycamRef ? String(opp.companycamRef) : null,
      },
      update: {
        roofrId: opp.roofrId ? String(opp.roofrId) : null,
        mrsJobId: opp.mrsJobId ? String(opp.mrsJobId) : null,
        companycamRef: opp.companycamRef ? String(opp.companycamRef) : null,
      },
    });
  }

  return Response.json({ lead: updated });
}
