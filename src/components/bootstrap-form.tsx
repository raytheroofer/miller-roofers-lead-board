"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { bootstrapAction, type BootstrapState } from "@/app/bootstrap/actions";
import { Button, Field, Label } from "@/components/ui";

const initialState: BootstrapState = {};

export function BootstrapForm() {
  const [state, formAction, isPending] = useActionState(bootstrapAction, initialState);
  const [copied, setCopied] = useState(false);

  function handleCopy(text: string) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      });
    }
  }

  if (state.success && state.inviteUrl) {
    const fullUrl =
      typeof window !== "undefined" && state.relativeUrl
        ? `${window.location.origin}${state.relativeUrl}`
        : state.inviteUrl;

    return (
      <div className="space-y-4">
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-950">
          <p className="font-semibold text-emerald-900">Owner invite generated!</p>
          <p className="mt-1 text-sm text-emerald-800">
            A single-use invite link for <strong>{state.email}</strong> is ready.
          </p>
        </div>

        <div>
          <Label htmlFor="generatedInvite">Invite URL</Label>
          <div className="flex gap-2">
            <Field
              id="generatedInvite"
              readOnly
              value={fullUrl}
              className="bg-card font-mono text-xs"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleCopy(fullUrl)}
              className="whitespace-nowrap"
            >
              {copied ? "Copied!" : "Copy link"}
            </Button>
          </div>
        </div>

        <div className="pt-2">
          <Link
            href={state.relativeUrl || state.inviteUrl}
            className="inline-flex w-full items-center justify-center rounded-md bg-navy px-3 py-2 text-sm font-medium text-white hover:bg-navy-2"
          >
            Open invite & set password now
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <div
          className="rounded-md bg-copper-soft px-3 py-2 text-sm text-copper"
          role="alert"
        >
          {state.error}
        </div>
      ) : null}

      <div>
        <Label htmlFor="secret">Bootstrap Secret</Label>
        <Field
          id="secret"
          name="secret"
          type="password"
          placeholder="Enter BOOTSTRAP_INVITE_SECRET"
          required
        />
        <p className="mt-1 text-xs text-muted">
          This secret is defined in your environment as <code>BOOTSTRAP_INVITE_SECRET</code>.
          It only works when no user has set a password yet.
        </p>
      </div>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Generating invite..." : "Generate owner invite link"}
      </Button>
    </form>
  );
}
