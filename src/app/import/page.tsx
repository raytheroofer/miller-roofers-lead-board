import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui";
import { CsvImportForm } from "@/components/csv-import-form";

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
      <h1 className="font-serif text-3xl">CSV import</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Storm lists, St. Johns permits, and the MRS Lead Log sheet land here as capture-stage leads. Import does not
        assign PMs and does not write Roofr.
      </p>
      <Card className="mt-6 max-w-3xl p-5">
        <CsvImportForm />
      </Card>
    </AppShell>
  );
}
