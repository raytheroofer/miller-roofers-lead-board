"use client";

import { useState } from "react";

export function ZeusUpload() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return <form className="mt-4 flex flex-wrap items-center gap-3" onSubmit={async event => {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem("snapshot") as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 4_000_000) { setMessage("File exceeds 4 MB."); return; }
    setBusy(true); setMessage("Importing research observations…");
    try {
      const response = await fetch("/api/storm-research/import", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: await file.text(),
      });
      const result = await response.json();
      if (!response.ok) { setMessage(result.error ?? "Import unconfirmed. Retry the same file."); return; }
      setMessage(`${result.inserted} saved; ${result.alreadyPresent} already present; ${result.flaggedGeography} flagged. No customer leads created.`);
      window.location.reload();
    } catch { setMessage("Import unconfirmed. Retry the same file."); }
    finally { setBusy(false); }
  }}>
    <label htmlFor="snapshot" className="text-sm">Import the private Zeus ZIP snapshot JSON</label>
    <input id="snapshot" name="snapshot" type="file" accept="application/json,.json" required className="text-sm" />
    <button disabled={busy} className="rounded-md bg-navy px-3 py-2 text-sm text-white disabled:opacity-50">Import research</button>
    <span role="status" className="text-sm">{message}</span>
  </form>;
}
