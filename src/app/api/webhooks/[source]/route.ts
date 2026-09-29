import { prisma } from "@/lib/prisma";
import { isWebhookSource } from "@/lib/sources";
import { safeWebhookHeaders, validWebhookSecret } from "@/lib/webhook-security";

export const dynamic = "force-dynamic";

async function storeWebhook(source: string, request: Request) {
  if (!isWebhookSource(source)) {
    return Response.json(
      { ok: false, error: `Unknown webhook source "${source}"` },
      { status: 404 },
    );
  }

  const secret = process.env.WEBHOOK_SECRET;
  if (process.env.FEATURE_WEBHOOK_INBOX !== "true" || !secret) {
    return Response.json({ ok: false, error: "Webhook inbox is disabled. Use manual intake." }, { status: 503 });
  }
  {
    const provided =
      request.headers.get("x-mrs-webhook-secret") ??
      request.headers.get("x-webhook-secret");
    if (!validWebhookSecret(provided, secret)) {
      return Response.json({ ok: false, error: "Invalid webhook secret" }, { status: 401 });
    }
  }

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return Response.json({ ok: false, error: "JSON is required" }, { status: 415 });
  }
  let payload: unknown;
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new Error("Empty body");
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 256_000) {
        await reader.cancel();
        return Response.json({ ok: false, error: "Payload too large" }, { status: 413 });
      }
      chunks.push(chunk.value);
    }
    payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const event = await prisma.webhookEvent.create({
    data: {
      source,
      payload: JSON.stringify(payload),
      headers: JSON.stringify(safeWebhookHeaders(request.headers)),
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
    mode: process.env.FEATURE_WEBHOOK_INBOX === "true" && process.env.WEBHOOK_SECRET ? "store_only" : "disabled",
    twilioLive: process.env.FEATURE_TWILIO_LIVE === "true",
    hint: `POST JSON to /api/webhooks/${source} to store a payload with no side effects.`,
  });
}
