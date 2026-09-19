/** Phase 1 feature flags. Live Twilio / Roofr writes stay OFF. */
export function isTwilioLive(): boolean {
  return process.env.FEATURE_TWILIO_LIVE === "true";
}

export function isRoofrWriteEnabled(): boolean {
  return process.env.FEATURE_ROOFR_WRITE === "true";
}

export function featureFlags() {
  return {
    phase: "1-track-only" as const,
    twilioLive: isTwilioLive(),
    roofrWrite: isRoofrWriteEnabled(),
    calendarSourceOfTruth: "roofr" as const,
    digestDestination: "firstmate" as const,
  };
}
