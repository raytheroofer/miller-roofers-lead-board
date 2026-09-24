import Link from "next/link";
import { validateInviteToken } from "@/lib/auth-service";
import { InviteForm } from "@/components/invite-form";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;

  const validation = await validateInviteToken(token);

  if (!validation.valid) {
    const isExpired = validation.reason === "expired";
    return (
      <div className="flex min-h-full items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <p className="text-xs uppercase tracking-[0.2em] text-copper">Miller Roofing Solutions LLC</p>
          <h1 className="mt-2 font-serif text-3xl leading-tight">Invitation not available</h1>
          <Card className="mt-6 p-6">
            <p className="text-sm text-ink">
              {isExpired
                ? "This invite link has expired. Invitations are valid for 7 days."
                : "This invite link is invalid or has already been used to set a password."}
            </p>
            <p className="mt-3 text-sm text-muted">
              Please contact Raymond Miller (owner) or your administrator to request a new invitation link.
            </p>
            <div className="mt-6">
              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center rounded-md bg-navy px-3 py-2 text-sm font-medium text-white hover:bg-navy-2"
              >
                Go to sign in
              </Link>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const { user } = validation;

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <p className="text-xs uppercase tracking-[0.2em] text-copper">Miller Roofing Solutions LLC</p>
        <h1 className="mt-2 font-serif text-3xl leading-tight">Welcome, {user.name}</h1>
        <p className="mt-2 text-sm text-muted">
          Create your password to activate your MRS Leaderboard account for <strong>{user.email}</strong>.
        </p>

        <div className="mt-6 rounded-xl border border-line bg-card p-5">
          <InviteForm token={token} userEmail={user.email} error={error} />
        </div>

        <div className="mt-6 text-center text-xs text-muted">
          <Link href="/login" className="underline hover:text-ink">
            Already have your password? Return to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
