"use client";

import { useState } from "react";
import { Button, Field, Label } from "@/components/ui";
import { setPasswordAction } from "@/app/invite/[token]/actions";

export function InviteForm({
  token,
  userEmail,
  error: serverError,
}: {
  token: string;
  userEmail: string;
  error?: string;
}) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);

  const displayError = clientError || serverError;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (password.length < 12) {
      e.preventDefault();
      setClientError("Password must be at least 12 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      e.preventDefault();
      setClientError("Passwords do not match.");
      return;
    }

    setClientError(null);
  }

  return (
    <form action={setPasswordAction} onSubmit={handleSubmit} className="space-y-4">
      {displayError ? (
        <div
          className="rounded-md bg-copper-soft px-3 py-2 text-sm text-copper"
          role="alert"
        >
          {displayError}
        </div>
      ) : null}

      <input type="hidden" name="token" value={token} />

      <div>
        <Label htmlFor="accountEmail">Email account</Label>
        <Field
          id="accountEmail"
          type="email"
          value={userEmail}
          disabled
          className="bg-card text-muted"
        />
      </div>

      <div>
        <Label htmlFor="password">Create password (min 12 characters)</Label>
        <Field
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (clientError) setClientError(null);
          }}
          placeholder="At least 12 characters"
          required
        />
        <p className="mt-1 text-xs text-muted">
          Must be at least 12 characters. Choose a unique password for MRS Leaderboard.
        </p>
      </div>

      <div>
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <Field
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={12}
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            if (clientError) setClientError(null);
          }}
          placeholder="Re-enter your password"
          required
        />
      </div>

      <Button type="submit" className="w-full">
        Activate account & continue to login
      </Button>
    </form>
  );
}
