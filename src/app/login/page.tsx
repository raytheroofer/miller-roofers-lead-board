import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { Button } from "@/components/ui";
import { LoginForm } from "@/components/login-form";
import { DEFAULT_ALLOWED_EMAILS } from "@/lib/users";
import { canCreateBootstrapInvite } from "@/lib/auth-service";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string; message?: string; email?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  if (session?.user) {
    redirect(params.callbackUrl || "/");
  }

  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const firstmate = process.env.FIRSTMATE_EMAIL ?? "firstmate@mrsroofers.com";
  const isBootstrapAvailable = await canCreateBootstrapInvite();

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <p className="text-xs uppercase tracking-[0.2em] text-copper">Miller Roofing Solutions LLC</p>
        <h1 className="mt-2 font-serif text-4xl leading-tight">Mrs Roofers lead tracker</h1>
        <p className="mt-3 text-sm text-muted">
          Jacksonville insurance-restoration roofing. Phase 1 is <strong>track only</strong> — no live call, no live SMS,
          no Roofr writeback.
        </p>

        <div className="mt-8 rounded-xl border border-line bg-card p-5">
          <LoginForm
            callbackUrl={params.callbackUrl || "/"}
            error={params.error}
            message={params.message}
            defaultEmail={params.email || "ray@mrsroofers.com"}
          />

          {googleEnabled ? (
            <form
              className="mt-3"
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: params.callbackUrl ?? "/" });
              }}
            >
              <Button type="submit" variant="ghost" className="w-full">
                Continue with Google
              </Button>
            </form>
          ) : null}
        </div>

        <div className="mt-6 space-y-2 text-xs leading-relaxed text-muted">
          <p>Allowlist: {DEFAULT_ALLOWED_EMAILS.join(", ")}, plus {firstmate}.</p>
          <p>
            Each staff member signs in with their individual password set via invite link.
          </p>
          {isBootstrapAvailable ? (
            <p className="pt-2">
              <Link href="/bootstrap" className="text-copper underline hover:text-ink">
                Initial setup? Run owner bootstrap
              </Link>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
