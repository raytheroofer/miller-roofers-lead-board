import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { NewLeadForm } from "@/components/lead-forms";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewLeadPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <AppShell
      userName={session.user.name ?? "Staff"}
      userEmail={session.user.email ?? ""}
      pathname="/leads/new"
    >
      <h1 className="font-serif text-3xl">Capture a lead</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Verify the lead in its original source, then capture it here. Create or find the opportunity in Roofr the same day
        and link its job number. Intake is manual; automatic import is paused during recovery.
      </p>
      <Card className="mt-6 max-w-3xl p-5">
        <NewLeadForm />
      </Card>
    </AppShell>
  );
}
