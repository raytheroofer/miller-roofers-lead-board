import { describe, expect, it } from "vitest";
import { parseZeusSnapshot, sameZeusObservation } from "@/lib/zeus-research";

const observation = (zip: string, id = `FL-20260912-${zip}`) => ({
  event_id: id, zip, state: "FL", county: "Nassau", city: "Callahan",
  storm_date: "2026-09-12", max_hail_in: 1, wind_gust_max_mph: 50,
  homes_affected: 20, confidence: 0.5, preliminary: false,
  swath_url: "https://getzeusai.com/canvass?swath_date=2026-09-12",
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
  it("keeps unknown vendor status preliminary", () => {
    for (const preliminary of [undefined, null, "false", 0, true]) {
      expect(parseZeusSnapshot(snapshot([{ ...observation("32011"), preliminary }]))[0].preliminary).toBe(true);
    }
    expect(parseZeusSnapshot(snapshot([observation("32011")]))[0].preliminary).toBe(false);
  });
  it("allows only HTTPS links to Zeus without embedded credentials", () => {
    for (const swath_url of ["https://example.invalid/swath", "https://getzeusai.com.evil.invalid/", "http://getzeusai.com/", "https://user:password@getzeusai.com/", "invalid"]) {
      expect(parseZeusSnapshot(snapshot([{ ...observation("32011"), swath_url }]))[0].swathUrl).toBeNull();
    }
    expect(parseZeusSnapshot(snapshot([observation("32011")]))[0].swathUrl).toContain("https://getzeusai.com/");
    const swath_url = "https://zeusportal.nyc3.cdn.digitaloceanspaces.com/geojson/RespondHailSizeGeoJSON20260912_CONUS.geojson";
    expect(parseZeusSnapshot(snapshot([{ ...observation("32011"), swath_url }]))[0].swathUrl).toBe(swath_url);
  });
  it("rejects conflicting event dates, blank geography and capture times without zones", () => {
    expect(() => parseZeusSnapshot(snapshot([{ ...observation("32011"), event_id: "FL-20260911-32011" }]))).toThrow(/date/);
    expect(() => parseZeusSnapshot(snapshot([{ ...observation("32011"), county: " " }]))).toThrow(/geography/);
    expect(() => parseZeusSnapshot({ ...snapshot([observation("32011")]), generated_at: "2026-09-12T21:58:38" })).toThrow(/envelope/);
  });
  it("distinguishes an unchanged retry from a vendor correction", () => {
    const original = parseZeusSnapshot(snapshot([observation("32011")]))[0];
    expect(sameZeusObservation(original, { ...original })).toBe(true);
    expect(sameZeusObservation(original, { ...original, hailIn: 0 })).toBe(false);
    expect(sameZeusObservation(original, { ...original, capturedAt: new Date("2026-09-13T00:00:00Z") })).toBe(false);
  });
});
