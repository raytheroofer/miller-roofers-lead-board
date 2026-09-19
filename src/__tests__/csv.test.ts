import { describe, expect, it } from "vitest";
import { parseCsv, rowsToLeads } from "@/lib/csv";

describe("CSV import", () => {
  it("parses quoted Jacksonville addresses and valid sources", () => {
    const csv = `name,phone,email,address,zip,source,notes,insurance_claim
James Whitaker,904-555-0142,james@example.com,"4821 Colonial Ave, Jacksonville FL",32210,zeus-wind,Wind claim,true
Bad Row,904-555-0000,x@example.com,Somewhere,32200,not-a-source,Nope,false
`;
    const { leads, errors } = rowsToLeads(parseCsv(csv));
    expect(leads).toHaveLength(1);
    expect(leads[0]?.name).toBe("James Whitaker");
    expect(leads[0]?.source).toBe("zeus-wind");
    expect(leads[0]?.insuranceClaim).toBe(true);
    expect(leads[0]?.address).toContain("Jacksonville");
    expect(errors.some((error) => error.includes("unknown source"))).toBe(true);
  });
});
