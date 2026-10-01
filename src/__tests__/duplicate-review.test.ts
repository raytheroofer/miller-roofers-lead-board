import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { duplicatePair, findDuplicatePairs, normalizedPhone, parseDuplicateReview, reviewForPair, type DuplicateLead } from "@/lib/duplicate-review";

const state = vi.hoisted(() => ({ actor: vi.fn(), tx: { lead: { findMany: vi.fn() },
  activity: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn() } } }));
vi.mock("@/lib/session", () => ({ actorFromSession: state.actor }));
vi.mock("@/lib/transaction", () => ({ serialTransaction: (run: (tx: typeof state.tx) => unknown) => run(state.tx) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { saveDuplicateReviewAction } from "@/app/duplicates/actions";

const lead = (id: string, fields: Partial<DuplicateLead> = {}): DuplicateLead => ({ id, name: `Example ${id}`, source: "website", stage: "capture", assignedPm: null,
  phones: "[]", email: null, address: null, zip: null, leadLogRowId: null, nextActionAt: null,
  updatedAt: new Date("2026-09-30T12:00:00Z"), createdAt: new Date("2026-09-30T12:00:00Z"), ...fields });
const a = lead("a", { phones: '["(904) 555-0100"]' });
const b = lead("b", { phones: '["+1 904 555 0100"]', source: "lsa" });
const pair = duplicatePair(a, b)!;
const savedBody = (note = "Verified separate roofing inquiries") => JSON.stringify({ version: 1, pairKey: pair.key, otherLeadId: b.id, fingerprint: pair.fingerprint, note });
const review = { id: "review-1", leadId: a.id, outcome: "separate", body: savedBody(), actorName: "owner@example.invalid", createdAt: new Date("2026-09-30T13:00:00Z") };
const captureId = "00000000-0000-4000-8000-000000000001";
const form = (extra: Record<string, string> = {}) => {
  const data = new FormData();
  for (const [key, value] of Object.entries({ captureId, firstId: a.id, secondId: b.id,
    firstVersion: a.updatedAt.toISOString(), secondVersion: b.updatedAt.toISOString(), reviewVersion: "",
    decision: "separate", note: "Verified separate roofing inquiries", ...extra })) data.set(key, value);
  return data;
};
beforeEach(() => {
  vi.resetAllMocks();
  state.actor.mockResolvedValue({ role: "pm", email: "staff@example.invalid", name: "Staff" });
  state.tx.lead.findMany.mockResolvedValue([a, b]);
  state.tx.activity.findMany.mockResolvedValue([]); state.tx.activity.findUnique.mockResolvedValue(null);
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("duplicate suggestions", () => {
  it("matches US formatting and country code across providers", () => {
    expect(pair.reasons).toEqual(["Shared phone"]);
    expect(duplicatePair(b, a)).toEqual(pair);
    expect(findDuplicatePairs([a,b]).pairs).toHaveLength(1);
  });
  it("keeps extensions and non-US country codes distinct", () => {
    expect(normalizedPhone("904-555-0100 ext. 32")).toBe("9045550100x32");
    expect(duplicatePair(a, lead("c", { phones: '["9045550100 x32"]' }))).toBeNull();
    expect(duplicatePair(a, lead("c", { phones: '["+9045550100"]' }))).toBeNull();
    expect(normalizedPhone("9045550100 x33")).not.toBe(normalizedPhone("9045550100 x32"));
  });
  it.each(["", "1234", "call me", "9045550100 or 1234"])("ignores incomplete or ambiguous phone %j", phone => {
    expect(normalizedPhone(phone)).toBeNull();
  });
  it("matches email case but preserves plus tags", () => {
    expect(duplicatePair(lead("a", { email: "CUSTOMER@Example.com " }), lead("b", { email: "customer@example.com" }))?.reasons).toEqual(["Shared email"]);
    expect(duplicatePair(lead("a", { email: "customer+job@example.com" }), lead("b", { email: "customer@example.com" }))).toBeNull();
  });
  it("requires address and ZIP and does not collapse apartment numbers", () => {
    const address = lead("a", { address: "123 Main St.", zip: "32201" });
    expect(duplicatePair(address, lead("b", { address: "123 main st", zip: "32201-1234" }))?.reasons).toEqual(["Matching address and ZIP"]);
    expect(duplicatePair(address, lead("b", { address: "123 Main St", zip: null }))).toBeNull();
    expect(duplicatePair(address, lead("b", { address: "123 Main St Apt 2", zip: "32201" }))).toBeNull();
  });
  it("never matches names or empty/malformed contact data alone", () => {
    expect(duplicatePair(lead("a", { name: "Same Name", phones: "invalid" }), lead("b", { name: "Same Name" }))).toBeNull();
    expect(duplicatePair(a, a)).toBeNull();
  });
  it("deduplicates suggestions with multiple matching fields and handles same-source repeats", () => {
    const all = [a,b].map(record => ({ ...record, source: "website", email: "same@example.invalid", phones: '["9045550100","(904) 555-0100"]' }));
    const result = findDuplicatePairs(all);
    expect(result.pairs).toHaveLength(1);
    expect(result.pairs[0].reasons).toEqual(["Shared email", "Shared phone"]);
  });
  it("explicitly reports an incomplete bounded comparison", () => {
    const result = findDuplicatePairs([a,b,lead("c", { phones: a.phones })], 1);
    expect(result.pairs).toHaveLength(1); expect(result.truncated).toBe(true);
  });
  it("keeps review after follow-up edits but reopens on changed contact information", () => {
    expect(reviewForPair(pair, [review]).decision).toBe("separate");
    const nextStep = duplicatePair({ ...a, stage: "contact", nextActionAt: new Date(), updatedAt: new Date() }, b)!;
    expect(reviewForPair(nextStep, [review]).decision).toBe("separate");
    const changed = duplicatePair({ ...a, email: "new@example.invalid" }, b)!;
    expect(reviewForPair(changed, [review]).decision).toBeNull();
  });
  it("uses only this pair's review, and respects explicit reopening", () => {
    expect(reviewForPair(pair, [{ ...review, leadId: "other" }]).decision).toBeNull();
    expect(reviewForPair(pair, [{ ...review, outcome: "reopen" }, review]).decision).toBe("reopen");
    expect(parseDuplicateReview('{"note":"not a review"}')).toBeNull();
  });
  it.each<Partial<DuplicateLead>>([{ address: "99 Different Street", zip: null }, { zip: "32209" }, { email: "incomplete-address" }])("reopens for changed contact fields omitted from discovery keys: %j", fields => {
    const changed = duplicatePair({ ...a, ...fields }, b)!;
    expect(changed.reasons).toEqual(["Shared phone"]);
    expect(reviewForPair(changed, [review]).decision).toBeNull();
  });
  it("tracks incomplete phone edits when email is the matching field", () => {
    const emailA = { ...a, phones: '["123"]', email: "same@example.invalid" };
    const emailB = { ...b, phones: "[]", email: "same@example.invalid" };
    const before = duplicatePair(emailA, emailB)!;
    const after = duplicatePair({ ...emailA, phones: '["456"]' }, emailB)!;
    expect(after.reasons).toEqual(["Shared email"]);
    expect(after.fingerprint).not.toBe(before.fingerprint);
  });
});

describe("duplicate review mutations", () => {
  it("denies anonymous actors before reading records", async () => {
    state.actor.mockRejectedValue(new Error("Unauthorized"));
    await expect(saveDuplicateReviewAction(form())).rejects.toThrow("Unauthorized");
    expect(state.tx.lead.findMany).not.toHaveBeenCalled();
  });
  it("saves a staff review as history without changing either lead or its assignment", async () => {
    expect(await saveDuplicateReviewAction(form())).toBeUndefined();
    expect(state.tx.activity.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      id: `duplicate_review_${captureId}`, leadId: "a", type: "duplicate_review", actorName: "staff@example.invalid", outcome: "separate", body: savedBody(),
    }) });
  });
  it("returns a saved result for an unchanged repeat and rejects a changed reuse", async () => {
    state.tx.activity.findUnique.mockResolvedValue({ ...review, id: `duplicate_review_${captureId}`, type: "duplicate_review", actorName: "staff@example.invalid" });
    expect(await saveDuplicateReviewAction(form())).toBeUndefined();
    expect(state.tx.activity.create).not.toHaveBeenCalled();
    expect((await saveDuplicateReviewAction(form({ decision: "related" })))?.error).toMatch(/different review/);
  });
  it("rejects stale record versions and another person's intervening review", async () => {
    expect((await saveDuplicateReviewAction(form({ firstVersion: "old" })))?.error).toMatch(/lead changed/);
    state.tx.activity.findMany.mockResolvedValue([review]);
    expect((await saveDuplicateReviewAction(form()))?.error).toMatch(/Another review/);
    expect(state.tx.activity.create).not.toHaveBeenCalled();
  });
  it("orders a new review after the previous one despite a clock collision", async () => {
    vi.useFakeTimers(); vi.setSystemTime(review.createdAt);
    state.tx.activity.findMany.mockResolvedValue([review]);
    expect(await saveDuplicateReviewAction(form({ reviewVersion: review.id, decision: "reopen" }))).toBeUndefined();
    expect(state.tx.activity.create).toHaveBeenCalledWith({ data: expect.objectContaining({ createdAt: new Date(review.createdAt.getTime() + 1) }) });
  });
  it("rejects unrelated records and cross-demo comparisons", async () => {
    state.tx.lead.findMany.mockResolvedValue([a, { ...b, phones: "[]" }]);
    expect((await saveDuplicateReviewAction(form()))?.error).toMatch(/no longer share/);
    state.tx.lead.findMany.mockResolvedValue([a, { ...b, name: "SYSTEM CHECK — sample" }]);
    expect((await saveDuplicateReviewAction(form()))?.error).toMatch(/same working or demo/);
    expect(state.tx.activity.create).not.toHaveBeenCalled();
  });
  it("does not expose database errors or contact notes through an unconfirmed save", async () => {
    const logger = vi.spyOn(console, "error").mockImplementation(() => {});
    state.tx.activity.create.mockRejectedValue(new Error("PRIVATE CONTACT NOTE and database connection details"));
    expect((await saveDuplicateReviewAction(form()))?.error).toMatch(/not confirmed/);
    expect(logger).toHaveBeenCalledExactlyOnceWith("duplicate_review_unconfirmed", { code: "retry_same_submission" });
  });
  it.each<Record<string, string>>([{ decision: "merge" }, { note: "" }, { captureId: "bad" }, { secondId: "a" }])("rejects invalid review input %j", async input => {
    expect((await saveDuplicateReviewAction(form(input)))?.error).toBeTruthy();
    expect(state.tx.activity.create).not.toHaveBeenCalled();
  });
});
