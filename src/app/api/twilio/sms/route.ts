import { featureFlags, isTwilioLive } from "@/lib/flags";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!isTwilioLive()) {
    return Response.json(
      {
        ok: false,
        blocked: true,
        reason: "FEATURE_TWILIO_LIVE is false. Phase 1 is track-only — log SMS by hand.",
        flags: featureFlags(),
      },
      { status: 403 },
    );
  }

  return Response.json(
    {
      ok: false,
      blocked: true,
      reason: "Live Twilio send is not implemented. Ray must unlock Phase 2 first.",
    },
    { status: 403 },
  );
}
