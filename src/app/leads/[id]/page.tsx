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
import { pmLabel } from "@/lib/rr";
import { sourceLabel } from "@/lib/sources";
import { canOverrideStages } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id } = await params;

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      activities: { orderBy: { occurredAt: "desc" } },
      appointments: { orderBy: { startsAt: "desc" } },
      assignments: { orderBy: { occurredAt: "desc" } },
      opportunity: true,
    },
  });

  if (!lead) notFound();

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
            <h1 className="font-serif text-3xl">{lead.name}</h1>
            <StageBadge stage={lead.stage} />
          </div>
          <p className="mt-2 text-sm text-muted">
            {sourceLabel(lead.source)} · {pmLabel(lead.assignedPm)} ·{" "}
            {lead.insuranceClaim ? "Insurance claim" : "Retail / other"} · {lead.address ?? "No address"}
          </p>
        </div>
        <div className="text-sm text-muted">
          <p>Phone: {parseJsonArray(lead.phones)[0] ?? "—"}</p>
          <p>Next action: {formatDateTime(lead.nextActionAt)}</p>
        </div>
      </div>

      <Card className="mb-5 p-4">
        <StageForm
          leadId={lead.id}
          stage={lead.stage}
          allowBackward={canOverrideStages(session.user.role)}
        />
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-5">
          <Card className="p-4">
            <h2 className="font-serif text-xl">Activity timeline</h2>
            {lead.activities.length === 0 ? (
              <p className="mt-4 text-sm text-muted">No touches yet. Log the first call or SMS.</p>
            ) : (
              <ol className="mt-4 space-y-3">
                {lead.activities.map((activity) => (
                  <li key={activity.id} className="border-l-2 border-line pl-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-medium capitalize">
                        {activity.type} · {activity.actor} · {activity.actorName}
                      </p>
                      <p className="text-xs text-muted">{formatDateTime(activity.occurredAt)}</p>
                    </div>
                    <p className="text-sm">{activity.summary ?? activity.outcome ?? "Logged"}</p>
                    {activity.body ? <p className="mt-1 text-sm text-muted">{activity.body}</p> : null}
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <div className="grid gap-5 md:grid-cols-2">
            <Card className="p-4">
              <h2 className="font-serif text-xl">Log call</h2>
              <div className="mt-3">
                <LogCallForm leadId={lead.id} />
              </div>
            </Card>
            <Card className="p-4">
              <h2 className="font-serif text-xl">Log SMS</h2>
              <div className="mt-3">
                <LogSmsForm leadId={lead.id} />
              </div>
            </Card>
          </div>

          <Card className="p-4">
            <h2 className="font-serif text-xl">Lead details</h2>
            <div className="mt-3">
              <LeadDetailsForm lead={lead} />
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-4">
            <h2 className="font-serif text-xl">Round-robin</h2>
            <p className="mt-1 text-sm text-muted">Current: {pmLabel(lead.assignedPm)}</p>
            <div className="mt-3">
              <AssignPanel leadId={lead.id} assignedPm={lead.assignedPm} />
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="font-serif text-xl">Assignment audit</h2>
            {lead.assignments.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No assignment events yet.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {lead.assignments.map((event) => (
                  <li key={event.id} className="rounded-md bg-[#f7f1e7] px-3 py-2">
                    <p>
                      {pmLabel(event.fromPm)} → {pmLabel(event.toPm)}
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
            <h2 className="font-serif text-xl">Set appointment</h2>
            <div className="mt-3">
              <SetAppointmentForm leadId={lead.id} defaultAssignee={lead.assignedPm} />
            </div>
            {lead.appointments.length > 0 ? (
              <ul className="mt-4 space-y-2 text-sm">
                {lead.appointments.map((appt) => (
                  <li key={appt.id} className="rounded-md border border-line px-3 py-2">
                    <p>
                      {formatDateTime(appt.startsAt)} · {pmLabel(appt.assignee)} · {appt.status}
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
            <h2 className="font-serif text-xl">Roofr / job links</h2>
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
