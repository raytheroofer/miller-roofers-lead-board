import { featureFlags, isRoofrWriteEnabled } from "@/lib/flags";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!isRoofrWriteEnabled()) {
    return Response.json(
      {
        ok: false,
        blocked: true,
        reason:
          "FEATURE_ROOFR_WRITE is false. Phase 1 stores a read-only Roofr ID on the lead. No opportunity create, no calendar write.",
        flags: featureFlags(),
      },
      { status: 403 },
    );
  }

  return Response.json(
    {
      ok: false,
      blocked: true,
      reason: "Roofr write APIs are locked until Ray unlocks Phase 2.",
    },
    { status: 403 },
  );
}
