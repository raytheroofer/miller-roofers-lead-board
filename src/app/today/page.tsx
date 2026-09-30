import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui";
import { isDemoLead } from "@/lib/demo-data";
import { formatDateTime } from "@/lib/utils";
import { pmLabel } from "@/lib/rr";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const now = new Date();
  const records = await prisma.lead.findMany({
    where: { stage: { not: "won" }, OR: [{ stage: { not: "lost_nurture" } }, { nextActionAt: { not: null } }] },
    include: { opportunity: true, activities: { where: { type: "next_action" }, orderBy: { occurredAt: "desc" }, take: 1 } },
    orderBy: [{ nextActionAt: "asc" }, { createdAt: "asc" }],
  });
  const leads = records.filter(lead => !isDemoLead(lead));
  const groups = [
    { title: "Needs a next action", rows: leads.filter(l => !l.nextActionAt) },
    { title: "Due now / overdue", rows: leads.filter(l => l.nextActionAt && l.nextActionAt <= now) },
    { title: "Upcoming", rows: leads.filter(l => l.nextActionAt && l.nextActionAt > now) },
  ];
  return <AppShell userName={session.user.name ?? "Owner"} userEmail={session.user.email ?? ""} pathname="/today">
    <h1 className="font-semibold tracking-tight text-3xl">Today</h1>
    <p className="mt-2 text-sm text-muted">{leads.length} open leads · Checked {formatDateTime(now)} ET. Record the source here, then open the job in Roofr.</p>
    <div className="my-5 flex flex-wrap gap-3 text-sm">
      <Link className="rounded-md bg-navy px-3 py-2 text-white" href="/leads/new">Capture a lead</Link>
      <a className="rounded-md border border-line px-3 py-2" href="https://app.roofr.com" target="_blank" rel="noreferrer">Roofr — jobs & calendar</a>
      <a className="rounded-md border border-line px-3 py-2" href="https://app.companycam.com" target="_blank" rel="noreferrer">CompanyCam — evidence</a>
    </div>
    <Card className="mb-5 p-4 text-sm">
      <strong>Morning review:</strong> Check incoming leads in the original channels, record the source, assign a person and a next action, then create or open the Roofr job the same day.
      <p className="mt-2 text-muted">Won work continues in Roofr. Demo and system-check records are excluded here. This queue does not claim to contain every active MRS job.</p>
    </Card>
    <div className="grid gap-5 lg:grid-cols-3">{groups.map(group => <section key={group.title}>
      <h2 className="mb-3 font-semibold tracking-tight text-xl">{group.title} <span className="text-sm text-muted">({group.rows.length})</span></h2>
      <div className="space-y-3">{group.rows.length === 0 ? <Card className="p-4 text-sm text-muted">No records in this group.</Card> : group.rows.map(lead => <Card key={lead.id} className="p-4">
        <Link href={`/leads/${lead.id}`} className="font-medium underline">{lead.name}</Link>
        <p className="mt-2 text-sm">{lead.nextActionAt ? lead.activities[0]?.summary ?? "Review the scheduled appointment" : "Choose the next action"}</p>
        <p className="mt-2 text-xs text-muted">{pmLabel(lead.assignedPm)} · {formatDateTime(lead.nextActionAt)}{lead.nextActionAt ? " ET" : ""}</p>
        <p className="mt-1 text-xs text-muted">Roofr job: {lead.opportunity?.roofrId ?? "Not linked — verify in Roofr"}</p>
      </Card>)}</div>
    </section>)}</div>
  </AppShell>;
}
