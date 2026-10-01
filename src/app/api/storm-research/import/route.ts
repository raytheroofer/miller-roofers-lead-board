import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseZeusSnapshot } from "@/lib/zeus-research";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const reply = (body: object, status: number) => Response.json(body, { status, headers });

export async function POST(request: Request) {
  const session = await auth();
  if (session?.user?.role !== "owner") return reply({ error: "Unauthorized" }, 401);
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply({ error: "Invalid origin" }, 403);
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") return reply({ error: "Expected JSON" }, 415);
  const length = Number(request.headers.get("content-length"));
  if (length > 4_000_000) return reply({ error: "Snapshot too large" }, 413);
  let rows;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 4_000_000) return reply({ error: "Snapshot too large" }, 413);
    rows = parseZeusSnapshot(JSON.parse(raw));
  } catch {
    return reply({ error: "Invalid Zeus snapshot; no records imported" }, 422);
  }
  // Stable IDs and skipDuplicates make an unchanged retry safe. An existing
  // observation is never overwritten by an older snapshot or a vendor correction.
  // Corrections require explicit review rather than silently promoting a ZIP.
  let inserted = 0;
  try {
    for (let index = 0; index < rows.length; index += 100) {
      const result = await prisma.stormObservation.createMany({
        data: rows.slice(index, index + 100), skipDuplicates: true,
      });
      inserted += result.count;
    }
  } catch {
    // Some batches may have committed. The same upload can safely be retried.
    return reply({ error: "Import incomplete; retry the same file", inserted, code: "retry_unchanged" }, 503);
  }
  return reply({ observations: rows.length, inserted, alreadyPresent: rows.length - inserted,
    flaggedGeography: rows.filter(row => row.quarantineReason).length, customerLeadsCreated: 0 }, 200);
}
