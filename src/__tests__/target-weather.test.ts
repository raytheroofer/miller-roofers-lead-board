import { afterEach, describe, expect, it, vi } from "vitest";
import { getTargetWeather, parseCountyAlerts } from "@/lib/target-weather";

const now = new Date("2026-10-02T20:00:00Z");
const props = { id: "urn:oid:nws-test-1", status: "Actual", messageType: "Alert", event: "Severe Thunderstorm Warning",
  sent: "2026-10-02T19:50:00Z", effective: "2026-10-02T19:50:00Z", expires: "2026-10-02T20:30:00Z",
  ends: null, headline: "County warning", areaDesc: "Part of county", instruction: "Seek shelter." };
const collection = (items: object[]) => ({ type: "FeatureCollection", features: items.map(properties => ({ properties })) });
const response = (body: object, responseAt = now.toUTCString()) => new Response(JSON.stringify(body), { headers: { Date: responseAt } });
afterEach(() => vi.restoreAllMocks());

describe("official county weather context", () => {
  it("keeps current actual wind/storm context and safety guidance; deduplicates IDs", () => {
    const alerts = parseCountyAlerts(collection([props, props]), now);
    expect(alerts).toHaveLength(1); expect(alerts[0].response).toBe("Seek shelter.");
  });
  it("excludes tests, cancellation, expired, future and unrelated hazard alerts", () => {
    const alerts = parseCountyAlerts(collection([{ ...props, status: "Test" }, { ...props, messageType: "Cancel" },
      { ...props, expires: "2026-10-02T19:59:00Z" }, { ...props, ends: "2026-10-02T19:59:00Z" },
      { ...props, effective: "2026-10-02T20:01:00Z" }, { ...props, event: "Rip Current Statement" }]), now);
    expect(alerts).toHaveLength(0);
  });
  it("never converts malformed or paginated coverage into a quiet-weather result", () => {
    for (const input of [{}, { type: "FeatureCollection", features: [null] }, collection([{ ...props, expires: "invalid" }]),
      { ...collection([]), pagination: { next: "https://api.weather.gov/alerts?page=2" } }]) {
      expect(() => parseCountyAlerts(input, now)).toThrow("Weather coverage unavailable");
    }
  });
  it("queries verified county codes in parallel, with bounded timeout and five minute revalidation", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => response(collection([])));
    const rows = await getTargetWeather(now, fetcher);
    expect(rows.every(row => row.state === "ok" && row.alerts.length === 0)).toBe(true);
    expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual([
      "https://api.weather.gov/alerts/active?zone=FLC109", "https://api.weather.gov/alerts/active?zone=FLC031", "https://api.weather.gov/alerts/active?zone=FLC089",
    ]);
    expect(fetcher.mock.calls[0][1]?.next?.revalidate).toBe(300);
    expect(fetcher.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });
  it("distinguishes network, stale-cache and malformed failures from confirmed empty responses", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValueOnce(new Error("private vendor failure"))
      .mockResolvedValueOnce(response(collection([]), "Fri, 02 Oct 2026 19:00:00 GMT"))
      .mockResolvedValueOnce(response({ broken: true }));
    const rows = await getTargetWeather(now, fetcher);
    expect(rows.every(row => row.state === "unavailable" && row.responseAt === null)).toBe(true);
    expect(JSON.stringify(rows)).not.toContain("private vendor failure");
  });
  it("keeps a healthy county usable when another request fails", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response(collection([props])))
      .mockResolvedValueOnce(new Response("denied", { status: 503 }))
      .mockResolvedValueOnce(response(collection([])));
    const rows = await getTargetWeather(now, fetcher);
    expect(rows.map(row => row.state)).toEqual(["ok", "unavailable", "ok"]);
    expect(rows[0].alerts).toHaveLength(1);
  });
});
