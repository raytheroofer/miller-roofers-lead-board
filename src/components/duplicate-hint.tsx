import Link from "next/link";
import { Card } from "@/components/ui";
import { getDuplicateQueue } from "@/lib/duplicate-directory";

export async function DuplicateHint({ leadId, showDemo = false }: { leadId?: string; showDemo?: boolean }) {
  const queue = await getDuplicateQueue(showDemo, leadId);
  const pairs = leadId ? queue.pairs : queue.pairs.filter(pair => [pair.first, pair.second]
    .some(lead => lead.stage !== "won" && (lead.stage !== "lost_nurture" || lead.nextActionAt)));
  const pending = pairs.filter(pair => !pair.decision || pair.decision === "reopen");
  const related = pairs.filter(pair => pair.decision === "related");
  if (!pending.length && !related.length && !queue.truncated) return null;
  const query = new URLSearchParams({ view: pending.length ? "pending" : "reviewed" });
  if (leadId) query.set("lead", leadId);
  if (showDemo) query.set("records", "demo");
  return <Card className="mb-5 border-amber-300 bg-amber-50 p-4 text-sm">
    <strong>Check related inquiries before follow-up.</strong>
    <p className="mt-1">{pending.length} possible duplicate {pending.length === 1 ? "pair needs" : "pairs need"} review · {related.length} {related.length === 1 ? "pair marked" : "pairs marked"} related.</p>
    {queue.truncated && <p className="mt-1">The comparison limit was reached; additional matches may exist.</p>}
    <Link className="mt-2 inline-block underline" href={`/duplicates?${query}`}>Open duplicate review</Link>
  </Card>;
}
