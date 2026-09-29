import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isLeadSource } from "@/lib/sources";
import { isStage } from "@/lib/stages";
import { isReadablePm } from "@/lib/rr";

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
      assignedPm: pm === "unassigned" ? null : pm && isReadablePm(pm) ? pm : undefined,
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

export async function POST() {
  if (!(await auth())?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ error: "API writes are paused during owner recovery. Use the lead forms." }, { status: 503 });
}
