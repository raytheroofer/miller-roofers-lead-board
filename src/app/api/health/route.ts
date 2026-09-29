import { featureFlags } from "@/lib/flags";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.lead.findFirst({ select: { id: true } });
  } catch {
    return Response.json({ ok: false, database: "unavailable", release: "owner-recovery-v1" }, { status: 503 });
  }
  return Response.json({
    ok: true,
    app: "mrs-lead-tracker",
    company: "Miller Roofing Solutions LLC / Mrs Roofers",
    flags: featureFlags(),
    database: "reachable",
    release: "owner-recovery-v1",
  });
}
