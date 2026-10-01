// Raw integration payloads are outside the lead-follow-up workspace.
// Do not query historical events, regardless of role or environment flags.
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ error: "Not found" }, {
    status: 404,
    headers: { "Cache-Control": "private, no-store" },
  });
}
