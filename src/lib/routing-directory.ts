import { prisma } from "@/lib/prisma";
import { DEFAULT_ASSIGNEES, RR_EXCLUDED, type Assignee } from "@/lib/rr";
import { STAFF_DIRECTORY } from "@/lib/users";
import type { Prisma } from "@prisma/client";

export const ASSIGNEE_ROLE = "lead_assignee";
export const ROUTING_SETTINGS_ID = "routing-directory-v1";
export type RoutingMember = Assignee & { email: string; version: string };
type DirectoryClient = Pick<Prisma.TransactionClient, "user" | "roundRobinCursor">;

export async function getRoutingDirectory(client: DirectoryClient = prisma): Promise<RoutingMember[]> {
  const [rows, configured] = await Promise.all([client.user.findMany({
    where: { OR: [{ slug: { in: DEFAULT_ASSIGNEES.map(member => member.slug) } }, { role: ASSIGNEE_ROLE }] },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { slug: true, name: true, email: true, inRrPool: true, role: true, updatedAt: true },
  }), client.roundRobinCursor.findUnique({ where: { id: ROUTING_SETTINGS_ID }, select: { id: true } })]);
  const builtins = DEFAULT_ASSIGNEES.map(member => {
    const row = rows.find(row => row.slug === member.slug);
    const identity = STAFF_DIRECTORY.find(person => person.slug === member.slug)!;
    // Old User flags were never used by routing. Keep the current live rotation
    // until the owner explicitly changes it through these controls.
    return { ...member, email: identity.email, inRrPool: configured ? row?.inRrPool ?? true : true,
      version: configured ? row?.updatedAt.toISOString() ?? "default" : "default" };
  });
  const custom = rows.filter(row => row.role === ASSIGNEE_ROLE
    && !DEFAULT_ASSIGNEES.some(member => member.slug === row.slug)
    && !RR_EXCLUDED.includes(row.slug as (typeof RR_EXCLUDED)[number]));
  return [...builtins, ...custom.map(row => ({ slug: row.slug, name: row.name, email: row.email,
    inRrPool: row.inRrPool, version: row.updatedAt.toISOString() }))];
}

// Existing tables suffice; this marker is written only by an authorized owner
// mutation, never by a read, build, seed or deployment.
export async function initializeRoutingSettings(tx: Prisma.TransactionClient) {
  if (await tx.roundRobinCursor.findUnique({ where: { id: ROUTING_SETTINGS_ID } })) return;
  for (const member of DEFAULT_ASSIGNEES) {
    const identity = STAFF_DIRECTORY.find(person => person.slug === member.slug)!;
    await tx.user.upsert({ where: { slug: member.slug }, update: { inRrPool: true }, create: { ...identity } });
  }
  await tx.roundRobinCursor.create({ data: { id: ROUTING_SETTINGS_ID, lastIndex: -1 } });
}

// Only assignment labels and pool state are passed into staff/client views.
export async function getAssignees(client: DirectoryClient = prisma): Promise<Assignee[]> {
  return (await getRoutingDirectory(client)).map(({ slug, name, inRrPool }) => ({ slug, name, inRrPool }));
}
