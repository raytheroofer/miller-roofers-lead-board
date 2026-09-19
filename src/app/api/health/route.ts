import { featureFlags } from "@/lib/flags";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ok: true,
    app: "mrs-lead-tracker",
    company: "Miller Roofing Solutions LLC / Mrs Roofers",
    flags: featureFlags(),
  });
}
