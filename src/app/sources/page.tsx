import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { INTAKE_SOURCE_IDS, INTAKE_SOURCES, intakeConfiguration } from "@/lib/intake-config";
import { INTAKE_RECEIPT_TYPE } from "@/lib/intake";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "owner") notFound();
  const sources = await Promise.all(INTAKE_SOURCE_IDS.map(async source => {
    const where = { type: INTAKE_RECEIPT_TYPE, actorName: INTAKE_SOURCES[source].label };
    const [count, latest] = await Promise.all([
      prisma.activity.count({ where }),
      prisma.activity.findFirst({ where, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    ]);
    return { source, configuration: intakeConfiguration(source), count, latest };
  }));
  return <AppShell userName={session.user.name ?? "Owner"} userEmail={session.user.email ?? ""} pathname="/sources">
    <h1 className="text-3xl font-semibold text-navy">Lead sources</h1>
    <p className="mt-2 text-sm text-muted">Owner view · Receipt counts confirm accepted deliveries, not that every provider lead has arrived.</p>
    <div className="my-5 flex flex-wrap gap-3 text-sm">
      <Link className="rounded-md bg-navy px-3 py-2 text-white" href="/?pm=unassigned">Review unassigned leads</Link>
      <Link className="rounded-md border border-line px-3 py-2" href="/today">Review follow-ups</Link>
    </div>
    <div className="grid gap-4 md:grid-cols-2">{sources.map(({ source, configuration, count, latest }) => <Card key={source} className="p-5">
      <h2 className="text-xl font-semibold">{INTAKE_SOURCES[source].label}</h2>
      <p className="mt-2 font-medium">{configuration === "disabled" ? "Off — setup required" : configuration === "needs-setup" ? "Blocked — configuration incomplete" : "Ready to receive — verify provider delivery"}</p>
      <p className="mt-2 text-sm">{count} accepted deliveries · Last received: {latest ? `${formatDateTime(latest.createdAt)} ET` : "None"}</p>
      <p className="mt-2 text-sm text-muted">{INTAKE_SOURCES[source].routing === "round-robin" ? "Paid leads only. Assigned Raymond → Cody Boyd, with a follow-up due immediately." : "New leads enter the unassigned queue with a review due immediately."}</p>
      <Link href={`/?source=${source}`} className="mt-3 inline-block text-sm underline">View these leads</Link>
    </Card>)}</div>
    <Card className="mt-5 p-5 text-sm">
      <h2 className="font-semibold">Before switching on a source</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5">
        <li>Secure the owner sign-in; confirm Cody’s separate sign-in before enabling Remodel Favor routing.</li>
        <li>Map the provider’s stable lead ID, contact details, original received time and short roofing request. Keep unrelated files, email bodies and meeting transcripts out.</li>
        <li>Send one clearly labeled test lead. Resend it to verify one record and one assignment. Then compare the first live delivery with the original provider.</li>
        <li>Check provider delivery failures and this board every business day. Search phone, email and address before contacting a lead that may also appear through another source.</li>
      </ol>
      <p className="mt-4 text-muted">Storm alerts and permit lists require qualification before becoming customer leads. Roofr remains the job and appointment system. Automatic Roofr job creation and customer messaging are not enabled.</p>
    </Card>
  </AppShell>;
}
