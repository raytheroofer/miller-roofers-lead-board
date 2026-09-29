import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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

export async function PATCH() {
  if (!(await auth())?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ error: "API writes are paused during owner recovery. Use the lead forms." }, { status: 503 });
}
