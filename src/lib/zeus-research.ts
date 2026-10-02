import { createHash } from "node:crypto";

export type ZeusObservation = {
  id: string;
  sourceEventId: string;
  zip: string;
  county: string;
  city: string;
  stormDate: Date;
  hailIn: number | null;
  windMph: number | null;
  homesAffected: number | null;
  confidence: number | null;
  preliminary: boolean;
  quarantineReason: string | null;
  swathUrl: string | null;
  capturedAt: Date;
};

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const numberOrNull = (value: unknown, max: number): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max ? value : null;

function sourceSwathUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 1000) return null;
  try {
    const url = new URL(value);
    const vendorHost = ["getzeusai.com", "www.getzeusai.com", "api.getzeusai.com"].includes(url.hostname) ||
      (url.hostname === "zeusportal.nyc3.cdn.digitaloceanspaces.com" && url.pathname.startsWith("/geojson/"));
    return url.protocol === "https:" && !url.username && !url.password && vendorHost
      ? url.href : null;
  } catch { return null; }
}

/** A changed observation is a correction requiring review, not an unchanged retry. */
export function sameZeusObservation(left: ZeusObservation, right: ZeusObservation): boolean {
  const fields = ["id", "sourceEventId", "zip", "county", "city", "hailIn", "windMph",
    "homesAffected", "confidence", "preliminary", "quarantineReason", "swathUrl"] as const;
  return fields.every(field => left[field] === right[field]) &&
    left.stormDate.getTime() === right.stormDate.getTime() &&
    left.capturedAt.getTime() === right.capturedAt.getTime();
}

/** Parse one known Zeus ZIP/day snapshot. These are observations, never property leads. */
export function parseZeusSnapshot(input: unknown): ZeusObservation[] {
  if (!object(input) || !Array.isArray(input.results) ||
      input.results.length < 1 || input.results.length > 6000 ||
      input.count !== input.results.length ||
      input.model_version !== "zeus-zip-rollup-v1" ||
      input.data_source !== "verisk_radar_modeled" ||
      typeof input.generated_at !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(input.generated_at)) {
    throw new Error("Invalid Zeus snapshot envelope");
  }
  const capturedAt = new Date(input.generated_at);
  if (!Number.isFinite(capturedAt.getTime())) throw new Error("Invalid capture time");
  const seen = new Set<string>();
  return input.results.map((row: unknown) => {
    if (!object(row) || typeof row.event_id !== "string" ||
        !/^FL-\d{8}-[A-Za-z0-9_-]{1,30}$/.test(row.event_id) ||
        typeof row.zip !== "string" || !/^\d{5}$/.test(row.zip) ||
        row.state !== "FL" || typeof row.county !== "string" ||
        typeof row.city !== "string" || typeof row.storm_date !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(row.storm_date)) {
      throw new Error("Invalid Zeus observation");
    }
    const stormDate = new Date(`${row.storm_date}T00:00:00Z`);
    if (!Number.isFinite(stormDate.getTime()) || stormDate.toISOString().slice(0, 10) !== row.storm_date ||
        row.county.length > 100 || row.city.length > 100 ||
        !row.county.trim() || !row.city.trim() || /[\u0000-\u001f\u007f]/.test(row.county + row.city) ||
        row.event_id.slice(3, 11) !== row.storm_date.replaceAll("-", "") ||
        stormDate.getTime() > capturedAt.getTime()) throw new Error("Invalid geography or date");
    const key = `${row.event_id}:${row.zip}`;
    if (seen.has(key)) throw new Error("Duplicate Zeus observation");
    seen.add(key);
    return {
      id: `zeus_${createHash("sha256").update(key).digest("hex")}`,
      sourceEventId: row.event_id,
      zip: row.zip,
      county: row.county.trim(),
      city: row.city.trim(),
      stormDate,
      hailIn: numberOrNull(row.max_hail_in, 12),
      windMph: numberOrNull(row.wind_gust_max_mph, 300),
      homesAffected: typeof row.homes_affected === "number" && Number.isInteger(row.homes_affected)
        ? numberOrNull(row.homes_affected, 10000000) : null,
      confidence: numberOrNull(row.confidence, 1),
      // Missing or malformed vendor status must never imply finalized evidence.
      preliminary: row.preliminary !== false,
      quarantineReason: /^3[234]\d{3}$/.test(row.zip) ? null : "Suspect Florida ZIP; verify geography",
      swathUrl: sourceSwathUrl(row.swath_url),
      capturedAt,
    };
  });
}
