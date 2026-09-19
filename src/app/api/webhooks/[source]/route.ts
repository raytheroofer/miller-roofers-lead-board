import { prisma } from "@/lib/prisma";
import { isWebhookSource } from "@/lib/sources";

export const dynamic = "force-dynamic";

const SENSITIVE_HEADER = /authorization|cookie|x-api-key|twilio-auth/i;

function redactHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key] = SENSITIVE_HEADER.test(key) ? "[redacted]" : value;
  });
  return out;
}

async function storeWebhook(source: string, request: Request) {
  if (!isWebhookSource(source)) {
    return Response.json(
      { ok: false, error: `Unknown webhook source "${source}"` },
      { status: 404 },
    );
  }

  const secret = process.env.WEBHOOK_SECRET;
  if (secret) {
    const provided =
      request.headers.get("x-mrs-webhook-secret") ??
      request.headers.get("x-webhook-secret");
    if (provided !== secret) {
      return Response.json({ ok: false, error: "Invalid webhook secret" }, { status: 401 });
    }
  }

  let payload: unknown;
  const contentType = request.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      payload = await request.json();
    } else {
      const text = await request.text();
      payload = text.length > 0 ? text : {};
    }
  } catch {
    payload = { parseError: true };
  }

  const event = await prisma.webhookEvent.create({
    data: {
      source,
      payload: JSON.stringify(payload),
      headers: JSON.stringify(redactHeaders(request.headers)),
      note: "stored_only",
    },
  });

  return Response.json({
    ok: true,
    id: event.id,
    source,
    stored: true,
    sideEffects: "none",
    message:
      "Phase 1 track-only: payload stored in webhook inbox. No lead created, no Twilio send, no Roofr write.",
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ source: string }> },
) {
  const { source } = await context.params;
  return storeWebhook(source, request);
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ source: string }> },
) {
  const { source } = await context.params;
  if (!isWebhookSource(source)) {
    return Response.json({ ok: false, error: "Unknown source" }, { status: 404 });
  }
  return Response.json({
    ok: true,
    source,
    mode: "store_only",
    twilioLive: process.env.FEATURE_TWILIO_LIVE === "true",
    hint: `POST JSON to /api/webhooks/${source} to store a payload with no side effects.`,
  });
}
