import { loginAction } from "@/app/login/actions";
import { Button, Field, Label } from "@/components/ui";

export function LoginForm({
  callbackUrl,
  error,
  defaultEmail,
}: {
  callbackUrl: string;
  error?: string;
  defaultEmail: string;
}) {
  return (
    <form action={loginAction} method="post" className="space-y-3">
      {error ? (
        <p className="rounded-md bg-copper-soft px-3 py-2 text-sm text-copper" role="alert">
          Sign-in failed. Use an allowlisted email and the env password.
        </p>
      ) : null}
      <input type="hidden" name="redirectTo" value={callbackUrl || "/"} />
      <div>
        <Label htmlFor="email">Email</Label>
        <Field
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          defaultValue={defaultEmail}
          placeholder="ray@mrsroofers.com"
          required
        />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Field
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="track-only"
          required
        />
      </div>
      <Button type="submit" className="w-full">
        Sign in
      </Button>
    </form>
  );
}
