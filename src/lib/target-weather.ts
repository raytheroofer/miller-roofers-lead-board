import { TARGET_COUNTIES, type TargetCountyCode } from "@/lib/marketing-targets";

export type CountyAlert = {
  id: string; event: string; headline: string; area: string;
  sent: Date; expires: Date; response: string;
};
export type CountyWeather = {
  code: TargetCountyCode; name: string; state: "ok" | "unavailable";
  responseAt: Date | null; alerts: CountyAlert[];
};
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const date = (value: unknown): Date | null => {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
};
const ROOFING_EVENTS = new Set([
  "Severe Thunderstorm Warning", "Severe Thunderstorm Watch", "Tornado Warning", "Tornado Watch",
  "High Wind Warning", "High Wind Watch", "Wind Advisory", "Extreme Wind Warning",
  "Hurricane Warning", "Hurricane Watch", "Tropical Storm Warning", "Tropical Storm Watch",
]);

/** County context only: a county alert is never a ZIP/property damage claim. */
export function parseCountyAlerts(input: unknown, now: Date): CountyAlert[] {
  if (!record(input) || input.type !== "FeatureCollection" || !Array.isArray(input.features) ||
    input.features.length > 300 || (record(input.pagination) && input.pagination.next)) {
    throw new Error("Weather coverage unavailable");
  }
  const alerts = new Map<string, CountyAlert>();
  for (const feature of input.features) {
    if (!record(feature) || !record(feature.properties)) throw new Error("Weather coverage unavailable");
    const p = feature.properties;
    if (["Test", "Exercise", "System", "Draft"].includes(String(p.status)) || p.messageType === "Cancel") continue;
    if (p.status !== "Actual" || !["Alert", "Update"].includes(String(p.messageType)) || typeof p.event !== "string") {
      throw new Error("Weather coverage unavailable");
    }
    if (!ROOFING_EVENTS.has(p.event)) continue;
    const sent = date(p.sent), effective = date(p.effective), expires = date(p.expires);
    const ended = p.ends == null ? expires : date(p.ends);
    if (!sent || !effective || !expires || !ended || typeof p.id !== "string" || !p.id ||
      typeof p.headline !== "string" || typeof p.areaDesc !== "string" ||
      expires.getTime() <= sent.getTime()) throw new Error("Weather coverage unavailable");
    if (expires <= now || ended <= now || effective > now || sent > now) continue;
    alerts.set(p.id, {
      id: p.id, event: p.event, headline: p.headline.slice(0, 500), area: p.areaDesc.slice(0, 500), sent, expires,
      response: typeof p.instruction === "string" ? p.instruction.slice(0, 1200) : "Follow the official alert instructions.",
    });
  }
  return [...alerts.values()].sort((a, b) => b.sent.getTime() - a.sent.getTime());
}

export async function getTargetWeather(now = new Date(), fetcher: typeof fetch = fetch): Promise<CountyWeather[]> {
  return Promise.all(TARGET_COUNTIES.map(async county => {
    try {
      const response = await fetcher(`https://api.weather.gov/alerts/active?zone=${county.code}`, {
        headers: { Accept: "application/geo+json", "User-Agent": "MRSLeadBoard/1.0 (https://mrs-leaderboard.vercel.app)" },
        next: { revalidate: 300 }, signal: AbortSignal.timeout(6000), redirect: "error",
      });
      if (!response.ok) throw new Error("Weather coverage unavailable");
      const responseAt = date(response.headers.get("date"));
      // Cached/old responses must not be described as a fresh quiet-weather check.
      if (!responseAt || now.getTime() - responseAt.getTime() > 15 * 60_000 ||
        responseAt.getTime() - now.getTime() > 5 * 60_000) throw new Error("Weather coverage unavailable");
      const text = await response.text();
      if (text.length > 1_000_000) throw new Error("Weather coverage unavailable");
      return { ...county, state: "ok" as const, responseAt, alerts: parseCountyAlerts(JSON.parse(text), now) };
    } catch {
      return { ...county, state: "unavailable" as const, responseAt: null, alerts: [] };
    }
  }));
}
