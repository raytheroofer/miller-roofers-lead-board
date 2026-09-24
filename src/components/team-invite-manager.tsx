"use client";

import { useActionState, useState } from "react";
import { createStaffInviteAction, type InviteActionState } from "@/app/admin/team/actions";
import { Button, Card, Field, Label, Select } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";

type StaffUserItem = {
  id: string;
  email: string;
  name: string;
  role: string;
  slug: string;
  inRrPool: boolean;
  hasPassword: boolean;
  passwordSetAt: Date | null;
  hasPendingInvite: boolean;
  isInviteExpired: boolean;
  inviteExpiresAt: Date | null;
};

const initialState: InviteActionState = {};

export function TeamInviteManager({
  staffUsers,
  allowedEmailList,
}: {
  staffUsers: StaffUserItem[];
  allowedEmailList: string[];
}) {
  const [state, formAction, isPending] = useActionState(createStaffInviteAction, initialState);
  const [selectedEmail, setSelectedEmail] = useState(allowedEmailList[0] || "");
  const [copied, setCopied] = useState(false);

  function handleCopy(text: string) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      });
    }
  }

  const activeInviteUrl =
    state.success && state.inviteUrl
      ? typeof window !== "undefined" && state.relativeUrl
        ? `${window.location.origin}${state.relativeUrl}`
        : state.inviteUrl
      : null;

  return (
    <div className="space-y-6">
      {activeInviteUrl ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/80 p-5 text-emerald-950 shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-semibold text-emerald-900">
              Invite link generated for {state.email}
            </h3>
            {state.emailSent ? (
              <span className="rounded-full bg-emerald-200 px-2.5 py-0.5 text-xs font-medium text-emerald-900">
                Email dispatched via Resend
              </span>
            ) : (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900">
                Email provider not configured — copy & send manually
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-emerald-800">
            This link is single-use and valid for 7 days. Once the user sets their password, the link expires.
          </p>

          <div className="mt-3 flex gap-2">
            <Field
              readOnly
              value={activeInviteUrl}
              className="bg-white font-mono text-xs"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleCopy(activeInviteUrl)}
              className="whitespace-nowrap"
            >
              {copied ? "Copied!" : "Copy invite link"}
            </Button>
          </div>
        </div>
      ) : null}

      <Card className="p-5">
        <h2 className="font-serif text-xl">Create staff invite</h2>
        <p className="mt-1 text-xs text-muted">
          Select an allowlisted email to generate a secure, single-use invite link.
        </p>

        <form action={formAction} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label htmlFor="emailSelect">Staff member</Label>
            <Select
              id="emailSelect"
              name="email"
              value={selectedEmail}
              onChange={(e) => setSelectedEmail(e.target.value)}
            >
              {allowedEmailList.map((email) => (
                <option key={email} value={email}>
                  {email}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Generating..." : "Generate invite link"}
          </Button>
        </form>

        {state.error ? (
          <p className="mt-3 rounded-md bg-copper-soft px-3 py-2 text-xs text-copper" role="alert">
            {state.error}
          </p>
        ) : null}
      </Card>

      <div>
        <h2 className="font-serif text-xl">Staff directory & login status</h2>
        <p className="mt-1 text-xs text-muted">
          Every user must set their own password via invite link before signing in. Shared passwords are disabled.
        </p>

        <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-[#f8f5ee] text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3">Staff member</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Round-robin pool</th>
                <th className="px-4 py-3">Password status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {staffUsers.map((user) => (
                <tr key={user.id} className="hover:bg-black/[0.01]">
                  <td className="px-4 py-3">
                    <p className="font-medium">{user.name}</p>
                    <p className="text-xs text-muted">{user.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block rounded-md bg-[#efe8da] px-2 py-0.5 text-xs font-medium uppercase">
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {user.inRrPool ? (
                      <span className="text-emerald-700 font-medium">In pool</span>
                    ) : (
                      <span className="text-muted">Excluded</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {user.hasPassword ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                        Active (set {user.passwordSetAt ? formatDateTime(user.passwordSetAt) : ""})
                      </span>
                    ) : user.hasPendingInvite ? (
                      <span className="inline-flex items-center gap-1.5 text-amber-700 font-medium">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        Invite pending (expires {user.inviteExpiresAt ? formatDateTime(user.inviteExpiresAt) : ""})
                      </span>
                    ) : user.isInviteExpired ? (
                      <span className="inline-flex items-center gap-1.5 text-copper font-medium">
                        <span className="h-1.5 w-1.5 rounded-full bg-copper" />
                        Invite expired
                      </span>
                    ) : (
                      <span className="text-muted">No password set</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <form action={formAction} className="inline">
                      <input type="hidden" name="email" value={user.email} />
                      <Button
                        type="submit"
                        variant="ghost"
                        className="text-xs py-1 px-2.5"
                        disabled={isPending}
                      >
                        {user.hasPassword
                          ? "Reissue invite"
                          : user.hasPendingInvite
                          ? "New link"
                          : "Send invite"}
                      </Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
