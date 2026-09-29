import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <AppShell
      userName={session.user.name ?? "Staff"}
      userEmail={session.user.email ?? ""}
      pathname="/import"
    >
      <h1 className="font-semibold tracking-tight text-3xl">CSV import</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Bulk import is paused during recovery because repeating an import can create duplicate leads.
      </p>
      <Card className="mt-6 max-w-3xl p-5">
        <p className="text-sm">Capture verified leads individually. Restore bulk import only after stable source IDs, duplicate review, and retry tests pass.</p>
      </Card>
    </AppShell>
  );
}
