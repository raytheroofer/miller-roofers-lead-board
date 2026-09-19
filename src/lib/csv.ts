import { isLeadSource, type LeadSource } from "@/lib/sources";

export const CSV_TEMPLATE_HEADERS = [
  "name",
  "phone",
  "email",
  "address",
  "zip",
  "source",
  "notes",
  "insurance_claim",
  "insurance_carrier",
  "roof_age",
  "urgency",
  "lead_log_row_id",
] as const;

export type CsvLeadRow = {
  name: string;
  phones: string[];
  email: string | null;
  address: string | null;
  zip: string | null;
  source: LeadSource;
  notesSummary: string | null;
  insuranceClaim: boolean;
  insuranceCarrier: string | null;
  roofAge: string | null;
  urgency: string | null;
  leadLogRowId: string | null;
};

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      row.push(current.trim());
      current = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(current.trim());
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      current = "";
      continue;
    }
    current += char;
  }
  if (current.length > 0 || row.length > 0) {
    row.push(current.trim());
    if (row.some((cell) => cell.length > 0)) rows.push(row);
  }
  return rows;
}

function truthy(value: string | undefined): boolean {
  const v = (value ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "y";
}

export function rowsToLeads(rows: string[][]): { leads: CsvLeadRow[]; errors: string[] } {
  if (rows.length === 0) {
    return { leads: [], errors: ["CSV is empty"] };
  }
  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const data = rows.slice(1);
  const idx = (name: string) => header.indexOf(name);
  const errors: string[] = [];
  const leads: CsvLeadRow[] = [];

  data.forEach((cells, index) => {
    const line = index + 2;
    const get = (name: string) => {
      const i = idx(name);
      return i >= 0 ? (cells[i] ?? "").trim() : "";
    };
    const name = get("name");
    if (!name) {
      errors.push(`Line ${line}: name is required`);
      return;
    }
    const sourceRaw = get("source") || "other";
    if (!isLeadSource(sourceRaw)) {
      errors.push(`Line ${line}: unknown source "${sourceRaw}"`);
      return;
    }
    const phone = get("phone") || get("phones");
    leads.push({
      name,
      phones: phone ? [phone] : [],
      email: get("email") || null,
      address: get("address") || null,
      zip: get("zip") || null,
      source: sourceRaw,
      notesSummary: get("notes") || null,
      insuranceClaim: truthy(get("insurance_claim")),
      insuranceCarrier: get("insurance_carrier") || null,
      roofAge: get("roof_age") || null,
      urgency: get("urgency") || null,
      leadLogRowId: get("lead_log_row_id") || null,
    });
  });

  return { leads, errors };
}

export function csvTemplate(): string {
  const sample = [
    CSV_TEMPLATE_HEADERS.join(","),
    'James Whitaker,904-555-0142,james.whitaker@example.com,"4821 Colonial Ave, Jacksonville FL",32210,zeus-wind,Wind claim after tropical system,true,State Farm,18,storm,LOG-1042',
  ];
  return `${sample.join("\n")}\n`;
}
