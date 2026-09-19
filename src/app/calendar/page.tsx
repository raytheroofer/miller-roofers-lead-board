import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { pmLabel } from "@/lib/rr";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const appointments = await prisma.appointment.findMany({
    include: { lead: true },
    orderBy: { startsAt: "asc" },
  });

  return (
    <AppShell
      userName={session.user.name ?? "Staff"}
      userEmail={session.user.email ?? ""}
      pathname="/calendar"
    >
      <h1 className="font-serif text-3xl">Calendar display</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Source of truth is the <strong>Roofr calendar</strong>. This page only shows human-entered appointments from the
        tracker. Phase 1 does not write Google or Roofr events.
      </p>

      {appointments.length === 0 ? (
        <Card className="mt-6 p-8 text-center text-sm text-muted">
          No appointments logged. Set one on a lead after the slot exists in Roofr.
        </Card>
      ) : (
        <div className="mt-6 space-y-3">
          {appointments.map((appt) => (
            <Card key={appt.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link href={`/leads/${appt.leadId}`} className="font-medium hover:text-copper">
                    {appt.lead.name}
                  </Link>
                  <p className="text-sm text-muted">
                    {formatDateTime(appt.startsAt)}
                    {appt.endsAt ? ` – ${formatDateTime(appt.endsAt)}` : ""} · {pmLabel(appt.assignee)}
                  </p>
                </div>
                <p className="text-xs uppercase tracking-wide text-muted">{appt.status}</p>
              </div>
              <p className="mt-2 text-xs text-muted">
                Roofr calendar id: {appt.roofrCalendarId ?? "not pasted yet"}
              </p>
              {appt.notes ? <p className="mt-2 text-sm">{appt.notes}</p> : null}
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
