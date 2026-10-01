// Generic payload intake is retired. Future lead-source adapters must validate
// and retain only approved lead fields, never arbitrary documents or headers.
export const dynamic = "force-dynamic";

export async function POST() {
  return Response.json({ error: "Webhook intake is disabled. Use manual lead capture." }, {
    status: 410,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET() {
  return Response.json({ error: "Not found" }, {
    status: 404,
    headers: { "Cache-Control": "private, no-store" },
  });
}
