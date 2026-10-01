import { authorizedIntake, intakeConfiguration, isIntakeSource } from "@/lib/intake-config";
import { IntakeError, parseIntakeLead, readIntakeBody } from "@/lib/intake-contract";
import { captureSourceLead } from "@/lib/intake";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const reply = (body: object, status: number) => Response.json(body, { status, headers });

export async function GET() { return reply({ error: "Not found" }, 404); }

export async function POST(request: Request, context: { params: Promise<{ source: string }> }) {
  const { source } = await context.params;
  if (!isIntakeSource(source)) return reply({ error: "Not found" }, 404);
  // Authentication precedes body reads. Session cookies, legacy webhook keys and
  // keys for other providers confer no access. No read/list operation is exposed.
  if (intakeConfiguration(source) !== "ready") return reply({ error: "Intake unavailable", code: "intake_unavailable" }, 503);
  if (!authorizedIntake(source, request.headers.get("authorization"))) return reply({ error: "Unauthorized" }, 401);
  try {
    const input = parseIntakeLead(await readIntakeBody(request), source);
    const result = await captureSourceLead(source, input);
    return reply(result, result.disposition === "created" ? 201 : 200);
  } catch (error) {
    if (error instanceof IntakeError) return reply({ error: error.message, code: error.code }, error.status);
    // Never log/echo customer input, credentials or database errors.
    console.warn("lead_intake_unconfirmed", { source, code: "retry_same_record" });
    return reply({ error: "Lead was not confirmed. Retry the same provider ID and unchanged fields.", code: "retry_same_record" }, 503);
  }
}
