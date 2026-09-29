import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui";
import { LoginForm } from "@/components/login-form";

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
    <div className="flex min-h-full flex-col bg-paper">
      <div className="bg-ink px-4 py-6 text-center">
        <BrandMark className="mx-auto h-20 w-20" />
        <p className="mt-3 font-serif text-xl text-white">Miller Roofing Solutions</p>
        <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-gold">Mrs Roofers · Jacksonville</p>
      </div>
      <div className="mx-auto w-full max-w-md flex-1 px-4 py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-dark">Miller Roofing Solutions LLC</p>
        <h1 className="mt-2 font-serif text-4xl leading-tight">Lead board</h1>
        <p className="mt-3 text-sm text-muted">
          Jacksonville insurance-restoration roofing. Phase 1 is <strong>track only</strong> — no live call, no live SMS,
          no Roofr writeback.
        </p>

        <div className="mt-8 rounded-xl border border-line bg-card p-5">
          <LoginForm
            callbackUrl={params.callbackUrl || "/"}
            error={params.error}
            defaultEmail="ray@mrsroofers.com"
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
