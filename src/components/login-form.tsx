import { loginAction } from "@/app/login/actions";
import { Button, Field, Label } from "@/components/ui";

export function LoginForm({
  callbackUrl,
  error,
  message,
  defaultEmail,
}: {
  callbackUrl: string;
  error?: string;
  message?: string;
  defaultEmail: string;
}) {
  return (
    <form action={loginAction} method="post" className="space-y-3">
      {message === "password_set" ? (
        <p className="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-800" role="status">
          Password set successfully. Please sign in with your email and new password.
        </p>
      ) : null}
      {error ? (
        <p className="rounded-md bg-copper-soft px-3 py-2 text-sm text-copper" role="alert">
          Sign-in failed. Please check your email and password. Ensure you have activated your account via invite link.
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
          placeholder="Enter your password"
          required
        />
      </div>
      <Button type="submit" className="w-full">
        Sign in
      </Button>
    </form>
  );
}
