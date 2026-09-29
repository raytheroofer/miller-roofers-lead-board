"use client";

import { useActionState } from "react";
import { saveNextAction, completeNextAction } from "@/app/next-action";
import { isRrPm, RR_POOL, RR_POOL_LABELS } from "@/lib/rr";
import { Button, Field, Label, Select } from "@/components/ui";

export function NextActionForm({ leadId, summary, due, dueIso, assignedPm, version }: {
  leadId: string; summary: string; due: string; dueIso: string; assignedPm: string | null; version: string;
}) {
  const [state, action, pending] = useActionState(saveNextAction, {});
  const [completeState, complete, completing] = useActionState(completeNextAction, {});
  return <div className="space-y-4">
    <form action={action} className="space-y-3">
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="expectedVersion" value={version} />
      <Label htmlFor="next-summary">Next action</Label>
      <Field id="next-summary" name="summary" required maxLength={500} defaultValue={summary} placeholder="Confirm inspection time with homeowner" />
      <Label htmlFor="next-due">Due — Eastern Time</Label>
      <Field id="next-due" name="due" type="datetime-local" required defaultValue={due} />
      <Label htmlFor="next-owner">Action owner / assigned PM</Label>
      <Select id="next-owner" name="assignedPm" required defaultValue={assignedPm && !isRrPm(assignedPm) ? "" : assignedPm ?? "raymond"}>
        <option value="" disabled>Choose an active owner</option>
        {RR_POOL.map(pm => <option key={pm} value={pm}>{RR_POOL_LABELS[pm]}</option>)}
      </Select>
      <Label htmlFor="assignment-reason">Reason if setting or changing owner</Label>
      <Field id="assignment-reason" name="assignmentReason" maxLength={500} required={!isRrPm(assignedPm)} placeholder="Why this person?" />
      <Button disabled={pending} type="submit">{pending ? "Saving…" : "Save next action"}</Button>
      <p role="status" className={state.error ? "text-red-800 text-sm" : "text-sm"}>{state.error ?? state.message}</p>
    </form>
    {dueIso && <form action={complete} className="space-y-2 border-t border-line pt-3">
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="expectedDue" value={dueIso} />
      <input type="hidden" name="expectedVersion" value={version} />
      <Label htmlFor="next-result">Result of completed action</Label>
      <Field id="next-result" name="result" required maxLength={1000} placeholder="What happened?" />
      <Button disabled={completing} variant="ghost" type="submit">{completing ? "Saving…" : "Complete action"}</Button>
      <p role="status" className={completeState.error ? "text-red-800 text-sm" : "text-sm"}>{completeState.error ?? completeState.message}</p>
    </form>}
  </div>;
}
