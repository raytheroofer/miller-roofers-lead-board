import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { Button } from "@/components/ui";
import { LoginForm } from "@/components/login-form";
import { BrandLogo } from "@/components/brand-logo";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  if (session?.user) {
    redirect(params.callbackUrl || "/");
  }

  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-4"><BrandLogo />
          <p className="text-xl font-semibold leading-tight text-navy">Miller Roofing<br />Solutions</p>
        </div>
        <p className="mt-7 text-xs font-semibold uppercase tracking-[0.18em] text-navy">Your MRS workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Keep every lead moving.</h1>
        <p className="mt-3 text-sm text-muted">
          Sign in to review leads, assign the next step and track follow-up. Jobs and appointments stay in Roofr.
        </p>

        <div className="mt-8 rounded-xl border border-line bg-card p-5">
          <LoginForm
            callbackUrl={params.callbackUrl || "/"}
            error={params.error}
            defaultEmail=""
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

        <p className="mt-6 text-xs text-muted">Private MRS workspace. Use your authorized account.</p>
      </div>
    </div>
  );
}
