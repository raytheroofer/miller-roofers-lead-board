import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { InputError } from "@/lib/input-error";

// A form keeps one internal record ID across retries. No business job ID is created here.
export async function captureManualLead(data: Prisma.LeadCreateInput & { id: string }) {
  const readExisting = async () => {
    const existing = await prisma.lead.findUnique({ where: { id: data.id } });
    if (!existing) return null;
    const fields = ["name", "source", "phones", "email", "address", "zip", "notesSummary",
      "insuranceCarrier", "roofAge", "urgency"] as const;
    if (fields.some(field => (existing[field] ?? null) !== (data[field] ?? null)) ||
      (existing.insuranceClaim ?? false) !== (data.insuranceClaim ?? false)) {
      throw new InputError("This form already saved a lead. Find it on the board to edit it, or reload this page to capture a different lead.");
    }
    return existing;
  };
  const existing = await readExisting();
  if (existing) return existing;
  try {
    return await prisma.lead.create({ data });
  } catch (error) {
    // The primary key also handles two copies of the same submission racing.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const saved = await readExisting();
      if (saved) return saved;
    }
    throw error;
  }
}
