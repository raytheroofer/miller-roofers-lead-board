import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { matchesLeadSearch } from "@/lib/lead-search";
const db = vi.hoisted(() => ({ lead: { findUnique: vi.fn(), create: vi.fn() } }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
import { captureManualLead } from "@/lib/manual-capture";

const lead = { id: "526c4e54-721b-420c-95c9-a61d78f730bd", name: "Sample Homeowner", source: "website",
  email: "owner@example.test", address: "123 Main Street", zip: "32210", phones: '["9045550123"]',
  opportunity: { roofrId: "12345678" } };
const input = { id: lead.id, name: lead.name, source: lead.source, email: lead.email, address: lead.address, phones: lead.phones, zip: lead.zip };
beforeEach(() => vi.resetAllMocks());

describe("finding an existing lead before capture", () => {
  it.each(["sample HOMEOWNER", "123   Main", "owner@example.test", "32210", "12345678", "(904) 555-0123", "+1 904 555 0123"])("finds a lead from %s", query => {
    expect(matchesLeadSearch(lead, query)).toBe(true);
  });
  it("does not treat digits inside unrelated text as a phone match", () => {
    expect(matchesLeadSearch(lead, "wrong 9045550123")).toBe(false);
    expect(matchesLeadSearch(lead, "another homeowner")).toBe(false);
  });
  it("handles blank searches and legacy plain-text phone storage", () => {
    expect(matchesLeadSearch(lead, " ")).toBe(true);
    expect(matchesLeadSearch({ ...lead, phones: "+1 (904) 555-0123" }, "9045550123")).toBe(true);
  });
});

describe("manual capture retries", () => {
  it("creates a new record once and returns the existing record on retry", async () => {
    db.lead.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(lead);
    db.lead.create.mockResolvedValue(lead);
    expect(await captureManualLead(input)).toEqual(lead);
    expect(await captureManualLead(input)).toEqual(lead);
    expect(db.lead.create).toHaveBeenCalledOnce();
  });
  it("recovers the committed record when concurrent submissions hit the primary key", async () => {
    db.lead.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(lead);
    db.lead.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "6" }));
    expect(await captureManualLead(input)).toEqual(lead);
    expect(db.lead.create).toHaveBeenCalledOnce();
  });
  it("does not silently reuse an old form for a different homeowner", async () => {
    db.lead.findUnique.mockResolvedValue(lead);
    await expect(captureManualLead({ ...input, name: "Different homeowner" })).rejects.toThrow("already saved a lead");
    expect(db.lead.create).not.toHaveBeenCalled();
  });
  it("does not silently discard changed notes on an already saved form", async () => {
    db.lead.findUnique.mockResolvedValue(lead);
    await expect(captureManualLead({ ...input, notesSummary: "New details" })).rejects.toThrow("already saved a lead");
    expect(db.lead.create).not.toHaveBeenCalled();
  });
  it("does not turn an unrelated database failure into a false successful capture", async () => {
    db.lead.findUnique.mockResolvedValue(null);
    db.lead.create.mockRejectedValue(new Error("database unavailable"));
    await expect(captureManualLead(input)).rejects.toThrow("database unavailable");
  });
});
