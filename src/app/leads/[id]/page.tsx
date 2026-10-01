import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/app-shell";
import { StageBadge } from "@/components/stage-badge";
import {
  AssignPanel,
  LeadDetailsForm,
  LogCallForm,
  LogSmsForm,
  OpportunityForm,
  SetAppointmentForm,
  StageForm,
} from "@/components/lead-forms";
import { Card } from "@/components/ui";
import { formatDateTime, parseJsonArray } from "@/lib/utils";
import { isAssignablePm, pmLabel } from "@/lib/rr";
import { getAssignees } from "@/lib/routing-directory";
import { sourceLabel } from "@/lib/sources";
import { canOverrideStages } from "@/lib/users";
import { NextActionForm } from "@/components/next-action-form";
import { easternInput } from "@/lib/eastern-time";
import { isDemoLead } from "@/lib/demo-data";
import { isIntakeSource } from "@/lib/intake-config";
import { safeSourceUrl } from "@/lib/intake-contract";
import { DuplicateHint } from "@/components/duplicate-hint";
import { DUPLICATE_REVIEW_TYPE, parseDuplicateReview } from "@/lib/duplicate-review";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id } = await params;

  const [assignees, lead] = await Promise.all([getAssignees(), prisma.lead.findUnique({
    where: { id },
    include: {
      activities: { orderBy: { occurredAt: "desc" } },
      appointments: { orderBy: { startsAt: "desc" } },
      assignments: { orderBy: { occurredAt: "desc" } },
      opportunity: true,
    },
  })]);

  if (!lead) notFound();

  const roofrTeamId = process.env.ROOFR_TEAM_ID ?? "137502";
  const roofrId = lead.opportunity?.roofrId;
  const roofrUrl = /^\d+$/.test(roofrTeamId) && roofrId && /^\d+(?:-\d+)*$/.test(roofrId)
    ? `https://app.roofr.com/dashboard/team/${roofrTeamId}/jobs/list-view?selectedJobId=${encodeURIComponent(roofrId)}`
    : null;
  const companycamRef = lead.opportunity?.companycamRef;
  const companycamUrl = companycamRef && /^https:\/\/app\.companycam\.com\/projects\/\d+\/?$/.test(companycamRef)
    ? companycamRef
    : null;

  return (
    <AppShell
      userName={session.user.name ?? "Staff"}
      userEmail={session.user.email ?? ""}
      pathname={`/leads/${id}`}
    >
      <div className="mb-4">
        <Link href="/" className="text-sm text-muted hover:text-ink">
          ← Board
        </Link>
      </div>

      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-semibold tracking-tight text-3xl">{lead.name}</h1>
            <StageBadge stage={lead.stage} />
          </div>
          <p className="mt-2 text-sm text-muted">
            {sourceLabel(lead.source)} · {pmLabel(lead.assignedPm, assignees)} ·{" "}
            {lead.insuranceClaim ? "Insurance claim" : "Retail / other"} · {lead.address ?? "No address"}
          </p>
        </div>
        <div className="text-sm text-muted">
          <p>Phone: {parseJsonArray(lead.phones)[0] ?? "—"}</p>
          <p>Next action: {formatDateTime(lead.nextActionAt)}</p>
        </div>
      </div>

      <Card className="mb-5 p-4">
        {isDemoLead(lead) && <p className="mb-3 text-sm text-copper">Demo / test record. Excluded from the Today work queue.</p>}
        {lead.assignedPm && !isAssignablePm(lead.assignedPm, assignees) && <p className="mb-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">This record has an inactive owner. Choose a current assignee and record the reason when reassigning. Past activity is preserved.</p>}
        <StageForm
          leadId={lead.id}
          stage={lead.stage}
          allowBackward={canOverrideStages(session.user.role)}
        />
      </Card>

      <DuplicateHint leadId={lead.id} showDemo={isDemoLead(lead)} />
      <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-5">
          <Card className="p-4">
            <h2 className="mb-3 font-semibold tracking-tight text-xl">Next action</h2>
            <NextActionForm assignees={assignees} key={lead.updatedAt.toISOString()} version={lead.updatedAt.toISOString()} leadId={lead.id}
              summary={lead.nextActionAt ? lead.activities.find(a => a.type === "next_action")?.summary ?? "" : ""}
              due={easternInput(lead.nextActionAt)} dueIso={lead.nextActionAt?.toISOString() ?? ""} assignedPm={lead.assignedPm} />
          </Card>
          <Card className="p-4">
            <h2 className="font-semibold tracking-tight text-xl">Activity timeline</h2>
            {lead.activities.length === 0 ? (
              <p className="mt-4 text-sm text-muted">No touches yet. Log the first call or SMS.</p>
            ) : (
              <ol className="mt-4 space-y-3">
                {lead.activities.map((activity) => (
                  <li key={activity.id} className="border-l-2 border-line pl-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-medium capitalize">
                        {activity.type === DUPLICATE_REVIEW_TYPE ? "Duplicate review" : activity.type} · {activity.actor} · {activity.actorName}
                      </p>
                      <p className="text-xs text-muted">{formatDateTime(activity.occurredAt)}</p>
                    </div>
                    <p className="text-sm">{activity.summary ?? activity.outcome ?? "Logged"}</p>
                    {activity.type === "source_received" ? <SourceReceipt body={activity.body} /> : activity.type === DUPLICATE_REVIEW_TYPE ? <p className="mt-1 text-sm text-muted">{parseDuplicateReview(activity.body)?.note ?? "Review history"}</p> : activity.body ? <p className="mt-1 text-sm text-muted">{activity.body}</p> : null}
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <div className="grid gap-5 md:grid-cols-2">
            <Card className="p-4">
              <h2 className="font-semibold tracking-tight text-xl">Log call</h2>
              <div className="mt-3">
                <LogCallForm leadId={lead.id} />
              </div>
            </Card>
            <Card className="p-4">
              <h2 className="font-semibold tracking-tight text-xl">Log SMS</h2>
              <div className="mt-3">
                <LogSmsForm leadId={lead.id} />
              </div>
            </Card>
          </div>

          <Card className="p-4">
            <h2 className="font-semibold tracking-tight text-xl">Lead details</h2>
            <div className="mt-3">
              <LeadDetailsForm lead={lead} />
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-4">
            <h2 className="font-semibold tracking-tight text-xl">Round-robin</h2>
            <p className="mt-1 text-sm text-muted">Current: {pmLabel(lead.assignedPm, assignees)}</p>
            <div className="mt-3">
              <AssignPanel assignees={assignees} leadId={lead.id} assignedPm={lead.assignedPm} source={lead.source} />
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="font-semibold tracking-tight text-xl">Assignment audit</h2>
            {lead.assignments.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No assignment events yet.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {lead.assignments.map((event) => (
                  <li key={event.id} className="rounded-md bg-paper px-3 py-2">
                    <p>
                      {pmLabel(event.fromPm, assignees)} → {pmLabel(event.toPm, assignees)}
                    </p>
                    <p className="text-xs text-muted">
                      {event.reason} · {event.actor} · {formatDateTime(event.occurredAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="font-semibold tracking-tight text-xl">Set appointment</h2>
            <div className="mt-3">
              <SetAppointmentForm assignees={assignees} leadId={lead.id} defaultAssignee={lead.assignedPm} />
            </div>
            {lead.appointments.length > 0 ? (
              <ul className="mt-4 space-y-2 text-sm">
                {lead.appointments.map((appt) => (
                  <li key={appt.id} className="rounded-md border border-line px-3 py-2">
                    <p>
                      {formatDateTime(appt.startsAt)} · {pmLabel(appt.assignee, assignees)} · {appt.status}
                    </p>
                    <p className="text-xs text-muted">
                      Roofr calendar: {appt.roofrCalendarId ?? "not linked"} · display only
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>

          <Card className="p-4">
            <h2 className="font-semibold tracking-tight text-xl">Roofr / job links</h2>
            {(roofrUrl || companycamUrl) && (
              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                {roofrUrl && <a href={roofrUrl} target="_blank" rel="noopener noreferrer" className="underline">Open saved Roofr job ↗</a>}
                {companycamUrl && <a href={companycamUrl} target="_blank" rel="noopener noreferrer" className="underline">Open saved CompanyCam project ↗</a>}
              </div>
            )}
            <div className="mt-3">
              <OpportunityForm
                leadId={lead.id}
                roofrId={lead.opportunity?.roofrId}
                mrsJobId={lead.opportunity?.mrsJobId}
                companycamRef={lead.opportunity?.companycamRef}
              />
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function SourceReceipt({ body }: { body: string | null }) {
  let receivedAt: string;
  let url: string | null;
  try {
    const receipt = JSON.parse(body ?? "{}");
    url = isIntakeSource(receipt.source) && typeof receipt.sourceUrl === "string" ? safeSourceUrl(receipt.source, receipt.sourceUrl) : null;
    receivedAt = formatDateTime(new Date(receipt.receivedAt));
  } catch { return null; }
  return <div className="mt-1 text-sm text-muted">
    <p>Received by source: {receivedAt} ET</p>
    {url && <a className="underline" href={url} target="_blank" rel="noopener noreferrer">Open original lead ↗</a>}
  </div>;
}
