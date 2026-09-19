"use client";

import { useState } from "react";
import { Button, Label } from "@/components/ui";

export function CsvImportForm() {
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setResult(null);
    setError(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/import/csv", { method: "POST", body: form });
    const json = (await response.json()) as { imported?: number; errors?: string[]; error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(json.error ?? "Import failed");
      if (json.errors?.length) setError(`${json.error ?? "Import failed"}: ${json.errors.join("; ")}`);
      return;
    }
    setResult(`Imported ${json.imported ?? 0} leads${json.errors?.length ? ` with ${json.errors.length} skipped rows` : ""}.`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label>CSV file</Label>
        <input
          name="file"
          type="file"
          accept=".csv,text/csv"
          required
          className="block w-full text-sm"
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? "Importing…" : "Import leads"}
        </Button>
        <a href="/templates/lead-import.csv" className="rounded-md border border-line px-3 py-2 text-sm">
          Download template
        </a>
      </div>
      {result ? <p className="text-sm text-ok">{result}</p> : null}
      {error ? <p className="text-sm text-copper">{error}</p> : null}
      <div className="rounded-md bg-[#f7f1e7] p-3 text-xs text-muted">
        Columns: name, phone, email, address, zip, source, notes, insurance_claim, insurance_carrier, roof_age,
        urgency, lead_log_row_id. Sources must match the locked enum (zeus-wind, lsa, website, …).
      </div>
    </form>
  );
}
