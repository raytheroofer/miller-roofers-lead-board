import { describe, expect, it } from "vitest";
import { parseZeusSnapshot } from "@/lib/zeus-research";

const observation = (zip: string, id = `FL-20260912-${zip}`) => ({
  event_id: id, zip, state: "FL", county: "Nassau", city: "Callahan",
  storm_date: "2026-09-12", max_hail_in: 1, wind_gust_max_mph: 50,
  homes_affected: 20, confidence: 0.5, preliminary: false,
  swath_url: "https://example.invalid/swath",
});
const snapshot = (results: unknown[]) => ({ count: results.length, results,
  generated_at: "2026-09-12T21:58:38Z", model_version: "zeus-zip-rollup-v1",
  data_source: "verisk_radar_modeled" });

describe("Zeus research import", () => {
  it("keeps modeled observations separate and flags suspect Florida ZIPs", () => {
    const rows = parseZeusSnapshot(snapshot([observation("32011"), observation("28202")]));
    expect(rows).toHaveLength(2);
    expect(rows[0].quarantineReason).toBeNull();
    expect(rows[1].quarantineReason).toMatch(/Suspect/);
    expect(rows[0].id).toBe(parseZeusSnapshot(snapshot([observation("32011")]))[0].id);
  });
  it("rejects duplicate rows and malformed envelopes before any database write", () => {
    expect(() => parseZeusSnapshot(snapshot([observation("32011"), observation("32011")]))).toThrow(/Duplicate/);
    expect(() => parseZeusSnapshot({ ...snapshot([observation("32011")]), count: 999 })).toThrow(/envelope/);
    expect(() => parseZeusSnapshot(snapshot([{ ...observation("32011"), storm_date: "2026-02-30" }]))).toThrow(/date/);
  });
});
