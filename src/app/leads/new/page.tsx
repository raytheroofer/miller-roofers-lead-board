import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { NewLeadForm } from "@/components/lead-forms";
import { Card } from "@/components/ui";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { primaryMarket } from "@/lib/marketing-targets";

export const dynamic = "force-dynamic";

export default async function NewLeadPage({ searchParams }: { searchParams: Promise<{ zip?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const market = primaryMarket((await searchParams).zip);

  return (
    <AppShell
      userName={session.user.name ?? "Staff"}
      userEmail={session.user.email ?? ""}
      pathname="/leads/new"
    >
      <h1 className="font-semibold tracking-tight text-3xl">Capture a lead</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Verify the lead in its original source, then capture it here. Create or find the opportunity in Roofr the same day
        and link its job number. Intake is manual; automatic import is paused during recovery.
      </p>
      <p className="mt-3 text-sm"><Link href="/?view=table" className="underline">Search existing leads</Link> by name, phone, address or Roofr job number before creating another record.</p>
      {market && <p className="mt-3 rounded-md bg-card p-3 text-sm">Target area: {market.zip} — {market.area}. Verify the actual property ZIP and contact details. Weather research alone is not a customer inquiry.</p>}
      <Card className="mt-6 max-w-3xl p-5">
        <NewLeadForm captureId={randomUUID()} defaultZip={market?.zip} />
      </Card>
    </AppShell>
  );
}
