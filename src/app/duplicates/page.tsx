import { randomUUID } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Area, Card, Label, Select } from "@/components/ui";
import { StageBadge } from "@/components/stage-badge";
import { getDuplicateQueue } from "@/lib/duplicate-directory";
import { getAssignees } from "@/lib/routing-directory";
import { pmLabel } from "@/lib/rr";
import { sourceLabel } from "@/lib/sources";
import { formatDateTime, parseJsonArray } from "@/lib/utils";
import { saveDuplicateReviewAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function DuplicatesPage({ searchParams }: {
  searchParams: Promise<{ view?: string | string[]; records?: string | string[]; page?: string | string[]; lead?: string | string[] }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const params = await searchParams;
  const showDemo = params.records === "demo", reviewed = params.view === "reviewed";
  const leadId = typeof params.lead === "string" ? params.lead : undefined;
  const [queue, assignees] = await Promise.all([getDuplicateQueue(showDemo, leadId), getAssignees()]);
  const pending = queue.pairs.filter(pair => !pair.decision || pair.decision === "reopen");
  const done = queue.pairs.filter(pair => pair.decision === "related" || pair.decision === "separate");
  const rows = reviewed ? done : pending;
  const pages = Math.max(1, Math.ceil(rows.length / 25));
  const requestedPage = typeof params.page === "string" && /^\d{1,6}$/.test(params.page) ? Number(params.page) : 1;
  const page = Math.min(pages, Math.max(1, requestedPage));
  const link = (view = reviewed ? "reviewed" : "pending", number = 1) => {
    const query = new URLSearchParams({ view, page: String(number) });
    if (showDemo) query.set("records", "demo");
    if (leadId) query.set("lead", leadId);
    return `/duplicates?${query}`;
  };
  return <AppShell userName={session.user.name ?? "Team"} userEmail={session.user.email ?? ""} pathname="/duplicates">
    <h1 className="text-3xl font-semibold text-navy">Duplicate review</h1>
    <p className="mt-2 text-sm text-muted">Compare inquiries before contacting a prospect twice. Suggestions use shared contact details or a matching address and ZIP; a match does not prove the same inquiry.</p>
    <p className="mt-2 text-sm text-muted">Reviews keep both records, assignments and follow-ups intact. For related inquiries, agree which record and person will handle the next step.</p>
    {showDemo && <p className="mt-3 text-copper">Demo / test records only.</p>}
    {leadId && <p className="mt-3 text-sm">Showing matches for one lead. <Link className="underline" href={showDemo ? "/duplicates?records=demo" : "/duplicates"}>Review all leads</Link></p>}
    <nav aria-label="Review status" className="my-5 flex flex-wrap gap-3 text-sm">
      <Link aria-current={!reviewed ? "page" : undefined} className="rounded-md border border-line px-3 py-2" href={link("pending")}>Needs review ({pending.length})</Link>
      <Link aria-current={reviewed ? "page" : undefined} className="rounded-md border border-line px-3 py-2" href={link("reviewed")}>Reviewed ({done.length})</Link>
      <Link className="rounded-md border border-line px-3 py-2" href="/today">Today</Link>
    </nav>
    <p className="mb-4 text-xs text-muted">Compared {queue.scanned} {showDemo ? "demo" : "working"} records, including closed inquiries. Name-only and approximate address matches are not detected; keep checking the original sources.</p>
    {queue.truncated && <Card className="mb-4 p-4 text-amber-900">The comparison limit was reached. This list is incomplete; search the board and review the original sources before follow-up.</Card>}
    <div className="space-y-5">{rows.slice((page - 1) * 25, page * 25).map(pair => <Card key={pair.key} className="p-5">
      <h2 className="text-lg font-semibold">{pair.reasons.join(" · ")}</h2>
      {pair.latest && !pair.decision && <p className="mt-2 text-sm text-amber-900">Contact details changed since the last review. Compare both records again.</p>}
      <div className="mt-4 grid gap-4 md:grid-cols-2">{[pair.first, pair.second].map(lead => <section key={lead.id} className="rounded-md border border-line p-4">
        <Link href={`/leads/${lead.id}`} className="text-lg font-semibold underline">{lead.name}</Link>
        <p className="my-2 text-sm">{sourceLabel(lead.source)} · {pmLabel(lead.assignedPm, assignees)}</p>
        <StageBadge stage={lead.stage} />
        <dl className="mt-3 space-y-2 text-sm">
          <div><dt className="text-muted">Phone</dt><dd>{parseJsonArray(lead.phones).join(" · ") || "Not provided"}</dd></div>
          <div><dt className="text-muted">Email</dt><dd className="break-words">{lead.email || "Not provided"}</dd></div>
          <div><dt className="text-muted">Address</dt><dd>{[lead.address, lead.zip].filter(Boolean).join(" · ") || "Not provided"}</dd></div>
          <div><dt className="text-muted">Next follow-up</dt><dd>{lead.nextActionAt ? `${formatDateTime(lead.nextActionAt)} ET` : "Needs a next action"}</dd></div>
        </dl>
      </section>)}</div>
      {pair.decision && pair.latest && <p className="mt-4 text-sm"><strong>{pair.decision === "related" ? "Related inquiry" : pair.decision === "separate" ? "Separate inquiries" : "Review reopened"}</strong> · {pair.latest.actorName} · {formatDateTime(pair.latest.createdAt)} ET<br />{pair.note}</p>}
      <ActionForm key={`${pair.latest?.id ?? "new"}:${pair.fingerprint}`} action={saveDuplicateReviewAction} className="mt-4 max-w-2xl space-y-3">
        <input type="hidden" name="captureId" value={randomUUID()} />
        <input type="hidden" name="firstId" value={pair.first.id} />
        <input type="hidden" name="secondId" value={pair.second.id} />
        <input type="hidden" name="firstVersion" value={pair.first.updatedAt.toISOString()} />
        <input type="hidden" name="secondVersion" value={pair.second.updatedAt.toISOString()} />
        <input type="hidden" name="reviewVersion" value={pair.latest?.id ?? ""} />
        <Label htmlFor={`outcome-${pair.key}`}>Review outcome</Label>
        <Select id={`outcome-${pair.key}`} name="decision" required defaultValue="">
          <option value="" disabled>Choose an outcome</option>
          <option value="related">Related inquiry — coordinate follow-up</option>
          <option value="separate">Separate inquiries</option>
          {pair.latest && <option value="reopen">Reopen for review</option>}
        </Select>
        <Label htmlFor={`note-${pair.key}`}>Reason and follow-up plan</Label>
        <Area id={`note-${pair.key}`} name="note" required minLength={5} maxLength={500} rows={2} placeholder="What did you verify, and who will handle the next step?" />
        <SubmitButton type="submit">Save review</SubmitButton>
      </ActionForm>
    </Card>)}</div>
    {!rows.length && <Card className="p-5">{reviewed ? "No matching pairs have a current completed review." : "No pending matches found in this comparison. Continue checking source records before follow-up."}</Card>}
    {pages > 1 && <nav aria-label="Review pages" className="mt-5 flex gap-4 text-sm">
      {page > 1 && <Link className="underline" href={link(undefined, page - 1)}>Previous</Link>}
      <span>Page {page} of {pages}</span>
      {page < pages && <Link className="underline" href={link(undefined, page + 1)}>Next</Link>}
    </nav>}
  </AppShell>;
}
