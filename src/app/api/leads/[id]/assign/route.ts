import { actorFromSession } from "@/lib/session";
import { assignManual, assignRoundRobin } from "@/lib/assign";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const actor = await actorFromSession();
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    mode?: string;
    toPm?: string;
    reason?: "manual_override" | "reassign";
  };

  try {
    if (body.mode === "manual") {
      if (!body.toPm) {
        return Response.json({ error: "toPm is required" }, { status: 400 });
      }
      const result = await assignManual({
        leadId: id,
        toPm: body.toPm,
        actorName: actor.name,
        reason: body.reason ?? "manual_override",
      });
      return Response.json(result);
    }

    const result = await assignRoundRobin({
      leadId: id,
      actorName: actor.name,
    });
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Assign failed" },
      { status: 400 },
    );
  }
}
