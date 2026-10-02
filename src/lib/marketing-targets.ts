import type { Prisma } from "@prisma/client";
import { isDemoLead } from "@/lib/demo-data";

// ZIP priorities supplied by the owner on October 2. Photo claims about wealth,
// roof ages, spend and conversion rates are deliberately not used as facts.
export const PRIMARY_MARKETS = [
  { zip: "32082", area: "Ponte Vedra Beach", county: "St. Johns", countyCode: "FLC109" },
  { zip: "32081", area: "Nocatee / Ponte Vedra", county: "St. Johns", countyCode: "FLC109" },
  { zip: "32259", area: "Bartram / Fruit Cove", county: "St. Johns", countyCode: "FLC109" },
  { zip: "32250", area: "Jacksonville Beach", county: "Duval", countyCode: "FLC031" },
  { zip: "32034", area: "Fernandina Beach / Amelia Island", county: "Nassau", countyCode: "FLC089" },
  { zip: "32223", area: "Mandarin South", county: "Duval", countyCode: "FLC031" },
  { zip: "32257", area: "Mandarin North / Beauclerc", county: "Duval", countyCode: "FLC031" },
] as const;
export const PRIMARY_ZIPS = PRIMARY_MARKETS.map(market => market.zip);
export const TARGET_COUNTIES = [
  { code: "FLC109", name: "St. Johns" },
  { code: "FLC031", name: "Duval" },
  { code: "FLC089", name: "Nassau" },
] as const;
export type TargetCountyCode = typeof TARGET_COUNTIES[number]["code"];

export function normalizedZip(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{5})(?:-\d{4})?$/.exec(value.trim());
  return match?.[1] ?? null;
}
export function primaryMarket(value: unknown) {
  const zip = normalizedZip(value);
  return PRIMARY_MARKETS.find(market => market.zip === zip);
}

// PostgreSQL's default DESC puts NULL first. Unknown hail must not hide known
// modeled values; ID makes rows with equal date/hazards deterministic.
export const STORM_RESEARCH_ORDER: Prisma.StormObservationOrderByWithRelationInput[] = [
  { stormDate: "desc" },
  { hailIn: { sort: "desc", nulls: "last" } },
  { windMph: { sort: "desc", nulls: "last" } },
  { id: "asc" },
];

type ResearchRow = {
  zip: string; stormDate: Date; capturedAt: Date; preliminary: boolean;
  quarantineReason: string | null; hailIn: number | null; windMph: number | null;
};
type WorkingLead = {
  zip: string | null; source: string; stage: string; name: string;
  email: string | null; leadLogRowId: string | null;
};

export function marketSummary(zip: string, observations: ResearchRow[], leads: WorkingLead[], now: Date) {
  const rows = observations.filter(row => normalizedZip(row.zip) === zip && row.quarantineReason === null &&
    row.stormDate.getTime() <= now.getTime() && row.capturedAt.getTime() <= now.getTime());
  const latest = [...rows].sort((a, b) => b.stormDate.getTime() - a.stormDate.getTime())[0] ?? null;
  const recent = rows.filter(row => !row.preliminary && now.getTime() - row.stormDate.getTime() <= 30 * 86400_000);
  const working = leads.filter(lead => normalizedZip(lead.zip) === zip && !isDemoLead(lead));
  return {
    observations: rows.length,
    finalizedRecent: recent.length,
    preliminary: rows.filter(row => row.preliminary).length,
    latest,
    leads: working.length,
    open: working.filter(lead => !["won", "lost_nurture"].includes(lead.stage)).length,
    won: working.filter(lead => lead.stage === "won").length,
    bySource: Object.entries(working.reduce<Record<string, number>>((counts, lead) => {
      counts[lead.source] = (counts[lead.source] ?? 0) + 1; return counts;
    }, {})),
  };
}

export function targetMarketCsv() {
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  return "priority,zip,area,county\r\n" + PRIMARY_MARKETS.map((market, index) =>
    [String(index + 1), market.zip, quote(market.area), quote(market.county)].join(",")
  ).join("\r\n") + "\r\n";
}
