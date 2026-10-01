import { prisma } from "@/lib/prisma";
import { isDemoLead } from "@/lib/demo-data";
import { DUPLICATE_REVIEW_TYPE, findDuplicatePairs, reviewForPair, type DuplicateLead } from "@/lib/duplicate-review";

export const DUPLICATE_LEAD_SELECT = {
  id: true, name: true, source: true, stage: true, assignedPm: true, phones: true, email: true,
  address: true, zip: true, leadLogRowId: true, nextActionAt: true, updatedAt: true, createdAt: true,
} as const;

export async function getDuplicateQueue(showDemo = false, leadId?: string) {
  const [records, reviews] = await Promise.all([
    prisma.lead.findMany({ select: DUPLICATE_LEAD_SELECT, orderBy: [{ createdAt: "desc" }, { id: "asc" }] }),
    prisma.activity.findMany({ where: { type: DUPLICATE_REVIEW_TYPE },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true, leadId: true, body: true, outcome: true, actorName: true, createdAt: true } }),
  ]);
  const leads: DuplicateLead[] = records.filter(lead => isDemoLead(lead) === showDemo);
  const { pairs, truncated } = findDuplicatePairs(leads);
  return { truncated, scanned: leads.length,
    pairs: pairs.filter(pair => !leadId || pair.first.id === leadId || pair.second.id === leadId)
      .map(pair => reviewForPair(pair, reviews)) };
}
