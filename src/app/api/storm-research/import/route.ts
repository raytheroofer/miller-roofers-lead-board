import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseZeusSnapshot, sameZeusObservation } from "@/lib/zeus-research";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const reply = (body: object, status: number) => Response.json(body, { status, headers });
const maxBytes = 4_000_000;

async function boundedBody(request: Request): Promise<string> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) { await reader.cancel(); throw new RangeError("Snapshot too large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks, bytes).toString("utf8");
}

class CorrectionConflict extends Error {
  constructor(readonly count: number) { super("Correction review required"); }
}

export async function POST(request: Request) {
  const session = await auth();
  if (session?.user?.role !== "owner") return reply({ error: "Unauthorized" }, 401);
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply({ error: "Invalid origin" }, 403);
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") return reply({ error: "Expected JSON" }, 415);
  const length = Number(request.headers.get("content-length"));
  if (length > maxBytes) return reply({ error: "Snapshot too large" }, 413);
  let rows;
  try {
    const raw = await boundedBody(request);
    rows = parseZeusSnapshot(JSON.parse(raw));
  } catch (error) {
    if (error instanceof RangeError) return reply({ error: "Snapshot too large" }, 413);
    return reply({ error: "Invalid Zeus snapshot; no records imported" }, 422);
  }
  // One serializable transaction makes imports atomic and unchanged concurrent
  // retries safe. A changed row is a correction, so reject the whole upload.
  let inserted = 0;
  try {
    inserted = await prisma.$transaction(async transaction => {
      const incoming = new Map(rows.map(row => [row.id, row]));
      let conflicts = 0;
      for (let index = 0; index < rows.length; index += 200) {
        const existing = await transaction.stormObservation.findMany({
          where: { id: { in: rows.slice(index, index + 200).map(row => row.id) } },
        });
        conflicts += existing.filter(row => !sameZeusObservation(incoming.get(row.id)!, row)).length;
      }
      if (conflicts) throw new CorrectionConflict(conflicts);
      let saved = 0;
      for (let index = 0; index < rows.length; index += 100) {
        saved += (await transaction.stormObservation.createMany({
          data: rows.slice(index, index + 100), skipDuplicates: true,
        })).count;
      }
      return saved;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60000 });
  } catch (error) {
    if (error instanceof CorrectionConflict) return reply({
      error: "Existing observations differ. Review the vendor correction before importing; no records changed.",
      code: "correction_review_required", conflicts: error.count, inserted: 0,
    }, 409);
    return reply({ error: "Import unconfirmed; retry the same file", inserted: 0, code: "retry_unchanged" }, 503);
  }
  return reply({ observations: rows.length, inserted, alreadyPresent: rows.length - inserted,
    flaggedGeography: rows.filter(row => row.quarantineReason).length, customerLeadsCreated: 0 }, 200);
}
