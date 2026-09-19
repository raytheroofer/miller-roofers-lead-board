import {
  assignManualAction,
  assignRoundRobinAction,
  createLeadAction,
  logActivityAction,
  setAppointmentAction,
  updateLeadDetailsAction,
  updateOpportunityAction,
  updateStageAction,
} from "@/app/actions";
import { Button, Field, Label, Select, Area } from "@/components/ui";
import { RR_POOL, RR_POOL_LABELS, type RrPm } from "@/lib/rr";
import { LEAD_SOURCES, SOURCE_LABELS } from "@/lib/sources";
import { STAGES, STAGE_LABELS, canTransition, type Stage } from "@/lib/stages";
import { parseJsonArray } from "@/lib/utils";
import type { Lead } from "@prisma/client";

export function LogCallForm({ leadId }: { leadId: string }) {
  return (
    <form action={logActivityAction} className="space-y-3">
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="type" value="call" />
      <p className="text-sm text-muted">Human-entered. Live Twilio dial is OFF.</p>
      <div>
        <Label>Direction</Label>
        <Select name="direction" defaultValue="outbound">
          <option value="outbound">Outbound</option>
          <option value="inbound">Inbound</option>
        </Select>
      </div>
      <div>
        <Label>Outcome</Label>
        <Select name="outcome" defaultValue="connected">
          <option value="connected">Connected</option>
          <option value="no_answer">No answer</option>
          <option value="voicemail">Voicemail</option>
          <option value="wrong_number">Wrong number</option>
          <option value="callback">Callback requested</option>
        </Select>
      </div>
      <div>
        <Label>Notes</Label>
        <Area name="body" rows={3} placeholder="What was said. Name the bot if a bot drafted this." />
      </div>
      <div>
        <Label>Summary</Label>
        <Field name="summary" placeholder="First call — storm claim, wants inspection" />
      </div>
      <Button type="submit">Log call</Button>
    </form>
  );
}

export function LogSmsForm({ leadId }: { leadId: string }) {
  return (
    <form action={logActivityAction} className="space-y-3">
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="type" value="sms" />
      <p className="text-sm text-muted">Human-entered. Mass SMS / Twilio send is OFF.</p>
      <div>
        <Label>Direction</Label>
        <Select name="direction" defaultValue="outbound">
          <option value="outbound">Outbound</option>
          <option value="inbound">Inbound</option>
        </Select>
      </div>
      <div>
        <Label>Outcome</Label>
        <Select name="outcome" defaultValue="sent">
          <option value="sent">Sent / logged</option>
          <option value="replied">Replied</option>
          <option value="opt_out">Opt out</option>
        </Select>
      </div>
      <div>
        <Label>Message</Label>
        <Area name="body" rows={3} placeholder="Paste the text. Do not send from this app." />
      </div>
      <div>
        <Label>Summary</Label>
        <Field name="summary" placeholder="Intro SMS logged" />
      </div>
      <Button type="submit">Log SMS</Button>
    </form>
  );
}

export function SetAppointmentForm({
  leadId,
  defaultAssignee,
}: {
  leadId: string;
  defaultAssignee: string | null;
}) {
  return (
    <form action={setAppointmentAction} className="space-y-3">
      <input type="hidden" name="leadId" value={leadId} />
      <p className="text-sm text-muted">
        Human-entered display only. Book the real slot in <strong>Roofr calendar</strong>, then paste the id.
      </p>
      <div>
        <Label>Starts</Label>
        <Field name="startsAt" type="datetime-local" required />
      </div>
      <div>
        <Label>Ends</Label>
        <Field name="endsAt" type="datetime-local" />
      </div>
      <div>
        <Label>Assignee</Label>
        <Select name="assignee" defaultValue={defaultAssignee ?? "raymond"}>
          {RR_POOL.map((pm) => (
            <option key={pm} value={pm}>
              {RR_POOL_LABELS[pm]}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Roofr calendar id</Label>
        <Field name="roofrCalendarId" placeholder="Paste from Roofr — we do not write the calendar" />
      </div>
      <div>
        <Label>Notes</Label>
        <Area name="notes" rows={2} placeholder="Homeowner prefers afternoon, dog in yard" />
      </div>
      <Button type="submit">Set appointment</Button>
    </form>
  );
}

export function AssignPanel({
  leadId,
  assignedPm,
}: {
  leadId: string;
  assignedPm: string | null;
}) {
  return (
    <div className="space-y-4">
      <form action={assignRoundRobinAction}>
        <input type="hidden" name="leadId" value={leadId} />
        <Button type="submit" variant="secondary" className="w-full">
          Round-robin assign (Ray → Austin → Cody)
        </Button>
      </form>
      <form action={assignManualAction} className="space-y-2">
        <input type="hidden" name="leadId" value={leadId} />
        <input type="hidden" name="reason" value={assignedPm ? "reassign" : "manual_override"} />
        <Label>Manual override</Label>
        <Select name="toPm" defaultValue={(assignedPm as RrPm) ?? "raymond"}>
          {RR_POOL.map((pm) => (
            <option key={pm} value={pm}>
              {RR_POOL_LABELS[pm]}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="ghost" className="w-full">
          Assign selected PM
        </Button>
      </form>
      <p className="text-xs text-muted">Chris Bell is out of the routing pool. Quiet RR — no notify.</p>
    </div>
  );
}

export function StageForm({
  leadId,
  stage,
  allowBackward,
}: {
  leadId: string;
  stage: string;
  allowBackward: boolean;
}) {
  const options = STAGES.filter((next) => canTransition(stage, next, { allowBackward }));
  return (
    <form action={updateStageAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <input type="hidden" name="leadId" value={leadId} />
      <div className="flex-1">
        <Label>Move stage</Label>
        <Select name="stage" defaultValue={options[0] ?? stage}>
          {options.map((next) => (
            <option key={next} value={next}>
              {STAGE_LABELS[next as Stage]}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex-1">
        <Label>Lost reason (if needed)</Label>
        <Field name="reasonCode" placeholder="price / not_insured / competitor" />
      </div>
      <Button type="submit">Update stage</Button>
    </form>
  );
}

export function LeadDetailsForm({ lead }: { lead: Lead }) {
  const phone = parseJsonArray(lead.phones)[0] ?? "";
  return (
    <form action={updateLeadDetailsAction} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="leadId" value={lead.id} />
      <div>
        <Label>Name</Label>
        <Field name="name" defaultValue={lead.name} />
      </div>
      <div>
        <Label>Phone</Label>
        <Field name="phone" defaultValue={phone} />
      </div>
      <div>
        <Label>Email</Label>
        <Field name="email" defaultValue={lead.email ?? ""} />
      </div>
      <div className="sm:col-span-2">
        <Label>Address</Label>
        <Field name="address" defaultValue={lead.address ?? ""} />
      </div>
      <div>
        <Label>ZIP</Label>
        <Field name="zip" defaultValue={lead.zip ?? ""} />
      </div>
      <div>
        <Label>Urgency</Label>
        <Select name="urgency" defaultValue={lead.urgency ?? "normal"}>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="storm">Storm</option>
          <option value="emergency">Emergency</option>
        </Select>
      </div>
      <div>
        <Label>Roof age</Label>
        <Field name="roofAge" defaultValue={lead.roofAge ?? ""} />
      </div>
      <div>
        <Label>Carrier</Label>
        <Field name="insuranceCarrier" defaultValue={lead.insuranceCarrier ?? ""} />
      </div>
      <div className="sm:col-span-2 flex items-center gap-2">
        <input id="insuranceClaim" name="insuranceClaim" type="checkbox" defaultChecked={lead.insuranceClaim} />
        <label htmlFor="insuranceClaim" className="text-sm">
          Insurance claim
        </label>
      </div>
      <div className="sm:col-span-2">
        <Label>Notes</Label>
        <Area name="notesSummary" rows={3} defaultValue={lead.notesSummary ?? ""} />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" variant="ghost">
          Save lead details
        </Button>
      </div>
    </form>
  );
}

export function OpportunityForm({
  leadId,
  roofrId,
  mrsJobId,
  companycamRef,
}: {
  leadId: string;
  roofrId?: string | null;
  mrsJobId?: string | null;
  companycamRef?: string | null;
}) {
  return (
    <form action={updateOpportunityAction} className="space-y-3">
      <input type="hidden" name="leadId" value={leadId} />
      <p className="text-sm text-muted">Read-only Roofr link. We do not create the opportunity from this app.</p>
      <div>
        <Label>Roofr ID</Label>
        <Field name="roofrId" defaultValue={roofrId ?? ""} placeholder="Paste existing Roofr opportunity id" />
      </div>
      <div>
        <Label>MRS Job ID</Label>
        <Field name="mrsJobId" defaultValue={mrsJobId ?? ""} />
      </div>
      <div>
        <Label>CompanyCam</Label>
        <Field name="companycamRef" defaultValue={companycamRef ?? ""} />
      </div>
      <Button type="submit" variant="ghost">
        Save links
      </Button>
    </form>
  );
}

export function NewLeadForm() {
  return (
    <form action={createLeadAction} className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label>Homeowner</Label>
        <Field name="name" required placeholder="James Whitaker" />
      </div>
      <div>
        <Label>Phone</Label>
        <Field name="phone" placeholder="904-555-0142" />
      </div>
      <div>
        <Label>Email</Label>
        <Field name="email" type="email" />
      </div>
      <div className="sm:col-span-2">
        <Label>Address</Label>
        <Field name="address" placeholder="4821 Colonial Ave, Jacksonville FL" />
      </div>
      <div>
        <Label>ZIP</Label>
        <Field name="zip" placeholder="32210" />
      </div>
      <div>
        <Label>Source</Label>
        <Select name="source" defaultValue="website">
          {LEAD_SOURCES.map((source) => (
            <option key={source} value={source}>
              {SOURCE_LABELS[source]}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Roof age</Label>
        <Field name="roofAge" />
      </div>
      <div>
        <Label>Urgency</Label>
        <Select name="urgency" defaultValue="normal">
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="storm">Storm</option>
          <option value="emergency">Emergency</option>
        </Select>
      </div>
      <div>
        <Label>Carrier</Label>
        <Field name="insuranceCarrier" />
      </div>
      <div className="flex items-center gap-2 sm:col-span-2">
        <input id="new-claim" name="insuranceClaim" type="checkbox" />
        <label htmlFor="new-claim" className="text-sm">
          Insurance claim
        </label>
      </div>
      <div className="sm:col-span-2">
        <Label>Notes</Label>
        <Area name="notesSummary" rows={3} />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit">Capture lead</Button>
      </div>
    </form>
  );
}
