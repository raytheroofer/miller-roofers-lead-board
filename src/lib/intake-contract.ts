import type { IntakeSource } from "@/lib/intake-config";

export class IntakeError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export type IntakeLead = {
  schemaVersion: 1; recordId: string; name: string; receivedAt: string;
  phone: string | null; phoneExtension: string | null; email: string | null;
  address: string | null; zip: string | null; request: string | null; sourceUrl: string | null;
};
const fields = new Set(["schemaVersion", "recordId", "name", "receivedAt", "phone", "phoneExtension", "email", "address", "zip", "request", "sourceUrl"]);
function invalid(message: string): never { throw new IntakeError(422, "invalid_lead", message); }

export function safeSourceUrl(source: IntakeSource, value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) return null;
    if (source === "lsa" && url.hostname === "ads.google.com" && url.pathname === "/localservices/lead" && /^\d+$/.test(url.searchParams.get("lid") ?? "")) {
      for (const [key, value] of url.searchParams) {
        if (["cid", "bid", "pid", "lid", "pli", "euid"].includes(key) ? !/^\d+$/.test(value) : !(["hl", "gl"].includes(key) && /^[a-zA-Z-]{2,8}$/.test(value))) return null;
        if (url.searchParams.getAll(key).length !== 1) return null;
      }
      return url.href;
    }
    if (source === "roofr-instant-estimator" && url.hostname === "app.roofr.com" && /^\/instant-estimator\/[a-zA-Z0-9/-]+$/.test(url.pathname) && !url.search) return url.href;
  } catch {}
  return null;
}

export function parseIntakeLead(input: unknown, source: IntakeSource, now = new Date()): IntakeLead {
  if (!input || typeof input !== "object" || Array.isArray(input)) invalid("Send one lead object.");
  const data = input as Record<string, unknown>;
  if (Object.keys(data).some(key => !fields.has(key))) invalid("Only the documented lead fields are accepted.");
  if (data.schemaVersion !== 1) invalid("schemaVersion must be 1.");
  const str = (key: string, max: number, required = false): string | null => {
    const value = data[key];
    if (value == null || value === "") { if (required) invalid(`${key} is required.`); return null; }
    if (typeof value !== "string" || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) invalid(`${key} must be plain text within its length limit.`);
    const result = value.trim();
    if (required && !result) invalid(`${key} is required.`);
    if (key !== "sourceUrl" && /https?:\/\/|drive\.google\.com|docs\.google\.com/i.test(result)) invalid("Document links and URLs belong outside lead text fields.");
    return result || null;
  };
  const recordId = str("recordId", 128, true)!;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/.test(recordId)) invalid("recordId must be the stable provider lead ID, using letters, digits, dots, colons, dashes or underscores.");
  const name = str("name", 160, true)!;
  const received = str("receivedAt", 35, true)!;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(received)) invalid("receivedAt must be an ISO timestamp with a time zone.");
  const date = new Date(received);
  if (!Number.isFinite(date.getTime()) || date.getTime() > now.getTime() + 5 * 60_000) invalid("receivedAt must be a valid timestamp, no more than five minutes in the future.");
  if (!new Date(`${received.slice(0, 10)}T00:00:00Z`).toISOString().startsWith(received.slice(0, 10))) invalid("receivedAt has an invalid calendar date.");
  let phone = str("phone", 32);
  if (phone) {
    if (!/^\+?[\d ().-]+$/.test(phone)) invalid("phone must contain a number without an extension.");
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) phone = `+1${digits}`;
    else if (digits.length === 11 && digits.startsWith("1")) phone = `+${digits}`;
    else if (phone.startsWith("+") && /^[1-9]\d{7,14}$/.test(digits)) phone = `+${digits}`;
    else invalid("phone must be a valid international or ten-digit US number.");
  }
  const phoneExtension = str("phoneExtension", 10);
  if (phoneExtension && (!phone || !/^\d+$/.test(phoneExtension))) invalid("phoneExtension requires a phone and must contain digits only.");
  const email = str("email", 254)?.toLowerCase() ?? null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) invalid("email must be a valid address.");
  const url = str("sourceUrl", 1000);
  const sourceUrl = url ? safeSourceUrl(source, url) : null;
  if (url && !sourceUrl) invalid("sourceUrl is not an approved link for this provider.");
  if (!phone && !email && !(source === "lsa" && sourceUrl)) invalid("Provide a phone or email; Google LSA may instead provide its original lead link.");
  const zip = str("zip", 10);
  if (zip && !/^\d{5}(?:-\d{4})?$/.test(zip)) invalid("zip must be a US ZIP code.");
  return { schemaVersion: 1, recordId, name, receivedAt: date.toISOString(), phone, phoneExtension, email,
    address: str("address", 300), zip, request: str("request", 500), sourceUrl };
}

export async function readIntakeBody(request: Request): Promise<unknown> {
  const max = 8 * 1024;
  if (Number(request.headers.get("content-length")) > max) throw new IntakeError(413, "too_large", "The lead exceeds 8 KB.");
  if (request.headers.get("content-encoding") && request.headers.get("content-encoding") !== "identity") throw new IntakeError(415, "unsupported_encoding", "Send uncompressed JSON.");
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new IntakeError(415, "invalid_content_type", "Send application/json.");
  const reader = request.body?.getReader();
  if (!reader) throw new IntakeError(400, "invalid_json", "Send a JSON lead.");
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.length;
      if (length > max) { await reader.cancel(); throw new IntakeError(413, "too_large", "The lead exceeds 8 KB."); }
      chunks.push(value);
    }
    try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks))); }
    catch { throw new IntakeError(400, "invalid_json", "Send valid UTF-8 JSON."); }
  } finally { reader.releaseLock(); }
}
