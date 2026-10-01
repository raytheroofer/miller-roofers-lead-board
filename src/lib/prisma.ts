import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Provider input must not end up in production query/error diagnostics.
    // Routes report fixed error codes; never log raw Prisma exceptions there.
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : [],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
