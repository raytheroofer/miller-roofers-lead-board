import Link from "next/link";
import type { Appointment, Lead, OpportunityLink } from "@prisma/client";
import { STAGES, STAGE_LABELS, type Stage } from "@/lib/stages";
import { sourceLabel } from "@/lib/sources";
import { pmLabel } from "@/lib/rr";
import { StageBadge } from "@/components/stage-badge";
import { parseJsonArray } from "@/lib/utils";

type LeadRow = Lead & {
  opportunity: OpportunityLink | null;
  appointments: Appointment[];
  _count: { activities: number };
};

export function LeadBoard({
  leads,
  view,
  query,
}: {
  leads: LeadRow[];
  view: "board" | "table";
  query: string;
}) {
  if (leads.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-card px-6 py-16 text-center">
        <p className="font-serif text-2xl">No leads in this view</p>
        <p className="mt-2 text-sm text-muted">
          Import a storm/permit CSV, capture a website lead, or add one by hand.
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <Link href="/leads/new" className="rounded-md bg-navy px-3 py-2 text-sm text-white">
            New lead
          </Link>
          <Link href="/import" className="rounded-md border border-line px-3 py-2 text-sm">
            CSV import
          </Link>
        </div>
      </div>
    );
  }

  if (view === "table") {
    return (
      <div className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[#f7f1e7] text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2">Lead</th>
              <th className="px-3 py-2">Stage</th>
              <th className="px-3 py-2">PM</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Phone</th>
              <th className="px-3 py-2">Claim</th>
              <th className="px-3 py-2">Roofr</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id} className="border-t border-line">
                <td className="px-3 py-2">
                  <Link href={`/leads/${lead.id}`} className="font-medium hover:text-copper">
                    {lead.name}
                  </Link>
                  <div className="text-xs text-muted">{lead.address ?? "No address"}</div>
                </td>
                <td className="px-3 py-2">
                  <StageBadge stage={lead.stage} />
                </td>
                <td className="px-3 py-2">{pmLabel(lead.assignedPm)}</td>
                <td className="px-3 py-2">{sourceLabel(lead.source)}</td>
                <td className="px-3 py-2">{parseJsonArray(lead.phones)[0] ?? "—"}</td>
                <td className="px-3 py-2">{lead.insuranceClaim ? "Claim" : "Retail"}</td>
                <td className="px-3 py-2">{lead.opportunity?.roofrId ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {STAGES.map((stage) => {
        const column = leads.filter((lead) => lead.stage === stage);
        return (
          <section key={stage} className="w-[240px] shrink-0">
            <header className="mb-2 flex items-baseline justify-between">
              <h2 className="text-sm font-medium">{STAGE_LABELS[stage as Stage]}</h2>
              <span className="text-xs text-muted">{column.length}</span>
            </header>
            <div className="min-h-[140px] space-y-2 rounded-xl bg-[#e8e1d4]/50 p-2">
              {column.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-muted">Empty</p>
              ) : (
                column.map((lead) => (
                  <Link
                    key={lead.id}
                    href={`/leads/${lead.id}${query}`}
                    className="block rounded-lg border border-line bg-card p-3 hover:border-copper/40"
                  >
                    <p className="font-medium leading-snug">{lead.name}</p>
                    <p className="mt-1 text-xs text-muted">{lead.zip ?? lead.address ?? "Jacksonville area"}</p>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
                      <span>{pmLabel(lead.assignedPm)}</span>
                      <span>{sourceLabel(lead.source)}</span>
                    </div>
                    {lead.insuranceClaim ? (
                      <p className="mt-2 text-[11px] text-copper">Insurance claim</p>
                    ) : null}
                  </Link>
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
