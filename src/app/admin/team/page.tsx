import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui";
import { listStaffWithAuthStatus } from "@/lib/auth-service";
import { allowedEmails } from "@/lib/users";
import { TeamInviteManager } from "@/components/team-invite-manager";

export const dynamic = "force-dynamic";

export default async function AdminTeamPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role;
  const isAuthorized = role === "owner" || role === "firstmate";

  const staffUsers = await listStaffWithAuthStatus();
  const emailList = allowedEmails();

  return (
    <AppShell
      userName={session.user.name ?? "Staff"}
      userEmail={session.user.email ?? ""}
      pathname="/admin/team"
    >
      <div className="mb-6">
        <h1 className="font-serif text-3xl">Staff invitations & access</h1>
        <p className="mt-1 text-sm text-muted">
          Manage per-user credentials and single-use invites. Staff members set their own passwords.
        </p>
      </div>

      {!isAuthorized ? (
        <Card className="p-6">
          <p className="text-sm font-medium text-copper">
            Access restricted to Raymond (owner) and Firstmate.
          </p>
          <p className="mt-1 text-xs text-muted">
            You are signed in as a project manager. Only owners or administrators can create and manage user invitations.
          </p>
        </Card>
      ) : (
        <TeamInviteManager
          staffUsers={staffUsers}
          allowedEmailList={emailList}
        />
      )}
    </AppShell>
  );
}
