import { PrismaClient } from "@prisma/client";
import { STAFF_DIRECTORY, firstmateEmail } from "../src/lib/users";

const prisma = new PrismaClient();

async function main() {
  console.log("Bootstrapping required staff users and round-robin cursor...");

  for (const staff of STAFF_DIRECTORY) {
    await prisma.user.upsert({
      where: { email: staff.email },
      update: {
        name: staff.name,
        slug: staff.slug,
        role: staff.role,
        inRrPool: staff.inRrPool,
      },
      create: {
        email: staff.email,
        name: staff.name,
        slug: staff.slug,
        role: staff.role,
        inRrPool: staff.inRrPool,
      },
    });
  }

  const fmEmail = firstmateEmail();
  await prisma.user.upsert({
    where: { email: fmEmail },
    update: {
      name: "Firstmate",
      slug: "firstmate",
      role: "firstmate",
      inRrPool: false,
    },
    create: {
      email: fmEmail,
      name: "Firstmate",
      slug: "firstmate",
      role: "firstmate",
      inRrPool: false,
    },
  });

  await prisma.roundRobinCursor.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", lastIndex: -1 },
  });

  console.log("Bootstrap complete. Staff directory and round-robin cursor are ready.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error("Bootstrap error:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
