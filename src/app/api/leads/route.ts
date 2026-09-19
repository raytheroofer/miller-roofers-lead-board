import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isLeadSource } from "@/lib/sources";
import { isStage } from "@/lib/stages";
import { isRrPm } from "@/lib/rr";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const stage = url.searchParams.get("stage");
  const pm = url.searchParams.get("pm");
  const source = url.searchParams.get("source");

  const leads = await prisma.lead.findMany({
    where: {
      stage: stage && isStage(stage) ? stage : undefined,
      assignedPm: pm === "unassigned" ? null : pm && isRrPm(pm) ? pm : undefined,
      source: source && isLeadSource(source) ? source : undefined,
    },
    include: {
      opportunity: true,
      appointments: { orderBy: { startsAt: "desc" }, take: 1 },
      _count: { select: { activities: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return Response.json({ leads });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const name = String(body.name ?? "").trim();
  if (!name) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }

  const source = String(body.source ?? "other");
  if (!isLeadSource(source)) {
    return Response.json({ error: "invalid source" }, { status: 400 });
  }

  const phones = Array.isArray(body.phones)
    ? body.phones.map(String)
    : body.phone
      ? [String(body.phone)]
      : [];

  const lead = await prisma.lead.create({
    data: {
      name,
      source,
      stage: "capture",
      phones: JSON.stringify(phones),
      email: body.email ? String(body.email) : null,
      address: body.address ? String(body.address) : null,
      zip: body.zip ? String(body.zip) : null,
      notesSummary: body.notesSummary ? String(body.notesSummary) : null,
      insuranceClaim: Boolean(body.insuranceClaim),
      insuranceCarrier: body.insuranceCarrier ? String(body.insuranceCarrier) : null,
      roofAge: body.roofAge ? String(body.roofAge) : null,
      urgency: body.urgency ? String(body.urgency) : null,
      leadLogRowId: body.leadLogRowId ? String(body.leadLogRowId) : null,
    },
  });

  await prisma.activity.create({
    data: {
      leadId: lead.id,
      type: "note",
      actor: "human",
      actorName: session.user.name ?? session.user.email ?? "staff",
      summary: "Lead captured",
      body: "Manual create in Phase 1 tracker",
    },
  });

  return Response.json({ lead }, { status: 201 });
}
