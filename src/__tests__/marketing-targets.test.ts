import { describe, expect, it } from "vitest";
import { PRIMARY_ZIPS, marketSummary, normalizedZip, primaryMarket, targetMarketCsv } from "@/lib/marketing-targets";

const now = new Date("2026-10-02T20:00:00Z");
const observation = { zip: "32082", stormDate: new Date("2026-09-20T00:00:00Z"), capturedAt: new Date("2026-09-21T00:00:00Z"), preliminary: false, quarantineReason: null, hailIn: 1, windMph: null };
const lead = { zip: "32082", source: "website", stage: "capture", name: "Customer", email: null, leadLogRowId: null };

describe("owner supplied territory", () => {
  it("activates only seven ordered ZIPs and exports only geography", () => {
    expect(PRIMARY_ZIPS).toEqual(["32082", "32081", "32259", "32250", "32034", "32223", "32257"]);
    const csv = targetMarketCsv();
    expect(csv.split("\r\n").filter(Boolean)).toHaveLength(8);
    expect(csv).not.toMatch(/32092|32095|32080|32246|32207|budget|income|revenue|password/i);
  });
  it("accepts exact ZIP and ZIP+4 without fuzzy geography or injection", () => {
    expect(normalizedZip(" 32082-1234 ")).toBe("32082");
    expect(primaryMarket("32082-1234")?.area).toBe("Ponte Vedra Beach");
    for (const value of [32082, "32082abc", "3208", "320820000", "<script>", ["32082"]]) expect(normalizedZip(value)).toBeNull();
    expect(primaryMarket("32092")).toBeUndefined();
  });
  it("excludes quarantine, future evidence and other ZIPs; distinguishes preliminary and old rows", () => {
    const rows = [observation, { ...observation, preliminary: true }, { ...observation, stormDate: new Date("2026-08-01") },
      { ...observation, quarantineReason: "disputed" }, { ...observation, zip: "32081" },
      { ...observation, stormDate: new Date("2026-10-03") }, { ...observation, capturedAt: new Date("2026-10-03") }];
    const result = marketSummary("32082", rows, [], now);
    expect(result.observations).toBe(3);
    expect(result.finalizedRecent).toBe(1);
    expect(result.preliminary).toBe(1);
    expect(result.latest?.stormDate).toEqual(observation.stormDate);
  });
  it("counts real lead outcomes by exact ZIP and source without treating modeled homes or demo as leads", () => {
    const result = marketSummary("32082", [observation], [lead, { ...lead, zip: "32082-1234", stage: "won" },
      { ...lead, name: "SYSTEM CHECK — territory fixture" }, { ...lead, zip: "32081" },
      { ...lead, source: "fb-lead", stage: "lost_nurture" }], now);
    expect(result.leads).toBe(3); expect(result.open).toBe(1); expect(result.won).toBe(1);
    expect(result.bySource).toEqual([["website", 2], ["fb-lead", 1]]);
  });
});
