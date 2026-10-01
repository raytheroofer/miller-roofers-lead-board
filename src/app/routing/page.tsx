import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { ActionForm } from "@/components/action-form";
import { Card, Field, Label } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { getRoutingDirectory } from "@/lib/routing-directory";
import { nextAvailableAssignee, RR_CURSOR_ID } from "@/lib/rr";
import { prisma } from "@/lib/prisma";
import { addAssigneeAction, setPoolMembershipAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function RoutingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "owner") notFound();
  const [members, cursor] = await Promise.all([
    getRoutingDirectory(), prisma.roundRobinCursor.findUnique({ where: { id: RR_CURSOR_ID } }),
  ]);
  const next = nextAvailableAssignee(cursor?.lastIndex ?? -1, members);
  const nextName = members.find(member => member.slug === next?.pm)?.name;
  const captureId = randomUUID();
  return <AppShell userName={session.user.name ?? "Owner"} userEmail={session.user.email ?? ""} pathname="/routing">
    <h1 className="text-3xl font-semibold text-navy">Lead routing</h1>
    <p className="mt-2 text-sm text-muted">Only paid Remodel Favor leads rotate automatically. Other sources enter the unassigned review queue.</p>
    <Card className="my-5 p-5">
      <h2 className="text-xl font-semibold">Paid-lead rotation</h2>
      <p className="mt-2">{members.filter(member => member.inRrPool).map(member => member.name).join(" → ") || "Everyone is paused"}</p>
      <p className="mt-2 text-sm text-muted">{nextName ? `Next up: ${nextName}. This can change when another lead arrives.` : "New paid leads will be saved as unassigned, with a review due immediately."}</p>
      <p className="mt-2 text-sm text-muted">Pausing affects future automatic assignments. Existing leads, appointments and assignment history remain intact. Paused members can still be assigned manually.</p>
      <Link href="/?pm=unassigned" className="mt-3 inline-block text-sm underline">Review unassigned leads</Link>
    </Card>
    <div className="grid gap-4 md:grid-cols-2">{members.map(member => <Card key={member.slug} className="p-5">
      <h2 className="text-lg font-semibold">{member.name}</h2>
      <p className="mt-1 text-sm text-muted">{member.email}</p>
      <p className="my-3 text-sm">{member.inRrPool ? "Receiving paid leads" : "Paid-lead rotation paused"}</p>
      <ActionForm key={member.version} action={setPoolMembershipAction}>
        <input type="hidden" name="slug" value={member.slug} />
        <input type="hidden" name="version" value={member.version} />
        <input type="hidden" name="enabled" value={String(!member.inRrPool)} />
        <SubmitButton type="submit" variant="secondary">{member.inRrPool ? `Pause ${member.name}` : `Add ${member.name} to rotation`}</SubmitButton>
      </ActionForm>
    </Card>)}</div>
    <Card className="mt-5 max-w-2xl p-5">
      <h2 className="text-xl font-semibold">Add a lead assignee</h2>
      <p className="mt-2 text-sm text-muted">The new person starts with paid-lead rotation paused. Adding an assignee does not create a sign-in or send an invitation; access is set up separately.</p>
      <ActionForm key={captureId} action={addAssigneeAction} className="mt-4 space-y-3">
        <input type="hidden" name="captureId" value={captureId} />
        <Label htmlFor="assignee-name">Name</Label>
        <Field id="assignee-name" name="name" required maxLength={100} />
        <Label htmlFor="assignee-email">Work email</Label>
        <Field id="assignee-email" name="email" type="email" required maxLength={254} />
        <SubmitButton type="submit">Add assignee</SubmitButton>
      </ActionForm>
    </Card>
  </AppShell>;
}
