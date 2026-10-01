import { InputError } from "@/lib/input-error";
/**
 * Default directory order is Raymond → Cody Boyd. Persisted pool settings are
 * applied by routing-directory; historical and paused positions remain stable.
 */
export const RR_POOL = ["raymond", "cody"] as const;
// A separate cursor avoids interpreting the previous three-person index as a two-person index.
export const RR_CURSOR_ID = "raymond-cody-v1";

export type RrPm = (typeof RR_POOL)[number];

export const RR_POOL_LABELS: Record<RrPm, string> = {
  raymond: "Raymond",
  cody: "Cody Boyd",
};

/** People who exist in the company but must never be auto-routed. */
export const RR_EXCLUDED = ["austin", "chris", "chris_bell", "chris-bell"] as const;

export function isRrPm(value: string | null | undefined): value is RrPm {
  return !!value && (RR_POOL as readonly string[]).includes(value);
}

// Read filters include former staff; mutations validate the current directory.
export type Assignee = { slug: string; name: string; inRrPool: boolean };
export const DEFAULT_ASSIGNEES: Assignee[] = RR_POOL.map(slug => ({ slug, name: RR_POOL_LABELS[slug], inRrPool: true }));

export function isAssignablePm(value: string | null | undefined, roster: readonly Assignee[]): value is string {
  return Boolean(value && !RR_EXCLUDED.includes(value as (typeof RR_EXCLUDED)[number]) && roster.some(member => member.slug === value));
}

export function isReadablePm(value: string | null | undefined, roster: readonly Assignee[] = DEFAULT_ASSIGNEES): value is string {
  return value === "austin" || isAssignablePm(value, roster);
}

// Indexes use the full, stable directory: pausing a member never shifts another member's turn.
export function nextAvailableAssignee(lastIndex: number, roster: readonly Assignee[]) {
  if (!Number.isInteger(lastIndex)) throw new InputError("lastIndex must be an integer");
  for (let offset = 1; offset <= roster.length; offset++) {
    const nextIndex = ((lastIndex + offset) % roster.length + roster.length) % roster.length;
    const member = roster[nextIndex];
    if (member.inRrPool && isAssignablePm(member.slug, roster)) return { pm: member.slug, nextIndex };
  }
  return null;
}

export function nextRoundRobin(lastIndex: number): {
  pm: RrPm;
  nextIndex: number;
} {
  if (!Number.isInteger(lastIndex)) {
    throw new InputError("lastIndex must be an integer");
  }
  const nextIndex = ((lastIndex + 1) % RR_POOL.length + RR_POOL.length) % RR_POOL.length;
  const pm = RR_POOL[nextIndex];
  if (!pm) {
    throw new InputError("Round-robin pool is empty");
  }
  return { pm, nextIndex };
}

export function previewRoundRobinOrder(startIndex = -1, count = RR_POOL.length * 2): RrPm[] {
  let last = startIndex;
  const order: RrPm[] = [];
  for (let i = 0; i < count; i += 1) {
    const step = nextRoundRobin(last);
    order.push(step.pm);
    last = step.nextIndex;
  }
  return order;
}

export function assertAssignablePm(slug: string): asserts slug is RrPm {
  if (RR_EXCLUDED.includes(slug as (typeof RR_EXCLUDED)[number])) {
    throw new InputError(`${pmLabel(slug)} is out of the routing pool`);
  }
  if (!isRrPm(slug)) {
    throw new InputError(`PM "${slug}" is not in the round-robin pool (Raymond → Cody)`);
  }
}

export function pmLabel(slug: string | null | undefined, roster: readonly Assignee[] = DEFAULT_ASSIGNEES): string {
  if (!slug) return "Unassigned";
  if (slug === "austin") return "Austin Maddox (inactive)";
  if (RR_EXCLUDED.includes(slug as (typeof RR_EXCLUDED)[number])) return "Chris Bell";
  const member = roster.find(member => member.slug === slug);
  if (member) return member.name;
  if (isRrPm(slug)) return RR_POOL_LABELS[slug];
  return slug;
}
