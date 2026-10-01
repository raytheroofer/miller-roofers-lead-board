import { createHash } from "node:crypto";
import { parseJsonArray } from "@/lib/utils";

export const DUPLICATE_REVIEW_TYPE = "duplicate_review";
export const DUPLICATE_PAIR_LIMIT = 5000;
export type DuplicateLead = {
  id: string; name: string; source: string; stage: string; assignedPm: string | null;
  phones: string; email: string | null; address: string | null; zip: string | null;
  leadLogRowId: string | null; nextActionAt: Date | null; updatedAt: Date; createdAt: Date;
};
export type DuplicateDecision = "related" | "separate" | "reopen";
export type DuplicatePair = {
  key: string; first: DuplicateLead; second: DuplicateLead; reasons: string[]; fingerprint: string;
};
export type DuplicateReviewBody = {
  version: 1; pairKey: string; otherLeadId: string; fingerprint: string; note: string;
};
export type DuplicateReview = {
  id: string; leadId: string; outcome: string | null; body: string | null; actorName: string; createdAt: Date;
};
export type ReviewedPair = DuplicatePair & { latest: DuplicateReview | null; decision: DuplicateDecision | null; note: string | null };

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const words = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

export function normalizedPhone(value: string): string | null {
  const extension = value.match(/(?:ext(?:ension)?\.?|x|#)\s*(\d+)\s*$/i);
  const base = (extension ? value.slice(0, extension.index) : value).trim();
  if (!/^[+\d\s().-]+$/.test(base)) return null;
  let digits = base.replace(/\D/g, "");
  if (base.startsWith("+") && !digits.startsWith("1")) return digits.length >= 8 && digits.length <= 15 ? `+${digits}${extension ? `x${extension[1]}` : ""}` : null;
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (digits.length === 10) return `${digits}${extension ? `x${extension[1]}` : ""}`;
  if (base.startsWith("+") && digits.length >= 8 && digits.length <= 15) return `+${digits}${extension ? `x${extension[1]}` : ""}`;
  return null;
}

function contactKeys(lead: DuplicateLead) {
  const keys = new Set<string>();
  for (const phone of parseJsonArray(lead.phones)) {
    const key = normalizedPhone(phone);
    if (key) keys.add(`phone:${key}`);
  }
  const email = words(lead.email ?? "");
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) keys.add(`email:${email}`);
  // Keep street suffixes and unit identifiers intact. A household/address match
  // is only a review suggestion, never proof of the same person or inquiry.
  const address = words(lead.address ?? "").replace(/[.,]/g, "").replace(/\s+/g, " ");
  const zip = (lead.zip ?? "").trim().match(/^\d{5}(?:-\d{4})?$/)?.[0].slice(0, 5);
  if (address.length >= 6 && /\d/.test(address) && zip) keys.add(`address:${address}|${zip}`);
  return [...keys].sort();
}

export function duplicatePair(first: DuplicateLead, second: DuplicateLead): DuplicatePair | null {
  if (first.id === second.id) return null;
  const [a, b] = first.id < second.id ? [first, second] : [second, first];
  const aKeys = contactKeys(a), bKeys = new Set(contactKeys(b));
  const matched = aKeys.filter(key => bKeys.has(key));
  if (!matched.length) return null;
  const reasons = [...new Set(matched.map(key => key.startsWith("phone:") ? "Shared phone" : key.startsWith("email:") ? "Shared email" : "Matching address and ZIP"))];
  return { key: hash([a.id, b.id]), first: a, second: b, reasons,
    // Discovery keys deliberately omit incomplete values. Review freshness must
    // cover every contact field, including an address that has no ZIP yet.
    fingerprint: hash([a, b].map(lead => [lead.id, words(lead.name), lead.source,
      words(lead.phones), words(lead.email ?? ""), words(lead.address ?? ""), words(lead.zip ?? "")])) };
}

export function findDuplicatePairs(leads: DuplicateLead[], limit = DUPLICATE_PAIR_LIMIT) {
  const buckets = new Map<string, DuplicateLead[]>();
  for (const lead of leads) for (const key of contactKeys(lead)) {
    const bucket = buckets.get(key) ?? [];
    bucket.push(lead); buckets.set(key, bucket);
  }
  const pairs = new Map<string, DuplicatePair>();
  let truncated = false;
  scan: for (const bucket of buckets.values()) for (let i = 0; i < bucket.length; i++) for (let j = i + 1; j < bucket.length; j++) {
    const pair = duplicatePair(bucket[i], bucket[j]);
    if (!pair || pairs.has(pair.key)) continue;
    if (pairs.size >= limit) { truncated = true; break scan; }
    pairs.set(pair.key, pair);
  }
  return { pairs: [...pairs.values()], truncated };
}

export function parseDuplicateReview(body: string | null): DuplicateReviewBody | null {
  try {
    const data = JSON.parse(body ?? "null");
    if (data?.version !== 1 || typeof data.pairKey !== "string" || !/^[a-f0-9]{64}$/.test(data.pairKey)
      || typeof data.otherLeadId !== "string" || !data.otherLeadId || data.otherLeadId.length > 128
      || typeof data.fingerprint !== "string" || !/^[a-f0-9]{64}$/.test(data.fingerprint)
      || typeof data.note !== "string" || data.note.length > 500) return null;
    return data;
  } catch { return null; }
}

export function isDuplicateDecision(value: string | null): value is DuplicateDecision {
  return value === "related" || value === "separate" || value === "reopen";
}

export function reviewForPair(pair: DuplicatePair, reviews: DuplicateReview[]): ReviewedPair {
  const latest = reviews.find(review => {
    const body = parseDuplicateReview(review.body);
    return review.leadId === pair.first.id && body?.pairKey === pair.key && body.otherLeadId === pair.second.id;
  }) ?? null;
  const body = parseDuplicateReview(latest?.body ?? null);
  const decision = body?.fingerprint === pair.fingerprint && isDuplicateDecision(latest?.outcome ?? null) ? latest!.outcome as DuplicateDecision : null;
  return { ...pair, latest, decision, note: decision ? body!.note : null };
}
