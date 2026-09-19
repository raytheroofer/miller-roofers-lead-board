import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const events = await prisma.webhookEvent.findMany({
    orderBy: { receivedAt: "desc" },
    take: 100,
  });

  return Response.json({
    events: events.map((event) => ({
      ...event,
      payload: safeJson(event.payload),
      headers: event.headers ? safeJson(event.headers) : null,
    })),
  });
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
