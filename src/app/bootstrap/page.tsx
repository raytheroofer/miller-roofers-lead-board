import Link from "next/link";
import { canCreateBootstrapInvite } from "@/lib/auth-service";
import { BootstrapForm } from "@/components/bootstrap-form";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function BootstrapPage() {
  const isAvailable = await canCreateBootstrapInvite();
  const hasSecretConfigured = Boolean(process.env.BOOTSTRAP_INVITE_SECRET?.trim());

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <p className="text-xs uppercase tracking-[0.2em] text-copper">Miller Roofing Solutions LLC</p>
        <h1 className="mt-2 font-serif text-3xl leading-tight">Owner bootstrap setup</h1>
        <p className="mt-2 text-sm text-muted">
          Initial setup for Raymond Miller (owner). This one-time mechanism generates an invite link to establish your account.
        </p>

        <Card className="mt-6 p-6">
          {!hasSecretConfigured ? (
            <div>
              <p className="text-sm text-copper">
                <code>BOOTSTRAP_INVITE_SECRET</code> is not configured in your server environment variables.
              </p>
              <p className="mt-2 text-xs text-muted">
                Add <code>BOOTSTRAP_INVITE_SECRET</code> to your deployment environment to enable owner bootstrap.
              </p>
              <div className="mt-4">
                <Link
                  href="/login"
                  className="inline-flex w-full items-center justify-center rounded-md bg-navy px-3 py-2 text-sm font-medium text-white hover:bg-navy-2"
                >
                  Return to sign in
                </Link>
              </div>
            </div>
          ) : !isAvailable ? (
            <div>
              <p className="text-sm text-ink">
                Bootstrap is locked. An account has already set a password.
              </p>
              <p className="mt-2 text-xs text-muted">
                Once any user sets a password, bootstrap is automatically disabled for security. Future invites must be sent from the admin team dashboard.
              </p>
              <div className="mt-4">
                <Link
                  href="/login"
                  className="inline-flex w-full items-center justify-center rounded-md bg-navy px-3 py-2 text-sm font-medium text-white hover:bg-navy-2"
                >
                  Go to sign in
                </Link>
              </div>
            </div>
          ) : (
            <BootstrapForm />
          )}
        </Card>

        <div className="mt-6 text-center text-xs text-muted">
          <Link href="/login" className="underline hover:text-ink">
            Return to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
