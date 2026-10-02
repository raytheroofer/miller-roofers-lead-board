CREATE TABLE "StormObservation" (
    "id" TEXT NOT NULL,
    "sourceEventId" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "county" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "stormDate" TIMESTAMP(3) NOT NULL,
    "hailIn" DOUBLE PRECISION,
    "windMph" DOUBLE PRECISION,
    "homesAffected" INTEGER,
    "confidence" DOUBLE PRECISION,
    "preliminary" BOOLEAN NOT NULL,
    "quarantineReason" TEXT,
    "swathUrl" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StormObservation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StormObservation_stormDate_zip_idx" ON "StormObservation"("stormDate", "zip");
CREATE INDEX "StormObservation_quarantineReason_idx" ON "StormObservation"("quarantineReason");
