import { PrismaClient } from "@prisma/client";
import { STAFF_DIRECTORY, firstmateEmail } from "../src/lib/users";

const prisma = new PrismaClient();

const leads = [
  {
    name: "James Whitaker",
    source: "zeus-wind",
    stage: "capture",
    assignedPm: null,
    phones: ["904-555-0142"],
    email: "james.whitaker@example.com",
    address: "4821 Colonial Ave, Jacksonville FL",
    zip: "32210",
    insuranceClaim: true,
    insuranceCarrier: "State Farm",
    roofAge: "18",
    urgency: "storm",
    notesSummary: "Wind claim after tropical system. Soft spots on the south slope.",
    leadLogRowId: "LOG-1042",
  },
  {
    name: "Maria Delgado",
    source: "lsa",
    stage: "qualify",
    assignedPm: null,
    phones: ["904-555-0198"],
    email: "maria.delgado@example.com",
    address: "918 San Marco Blvd, Jacksonville FL",
    zip: "32207",
    insuranceClaim: true,
    insuranceCarrier: "Citizens",
    roofAge: "22",
    urgency: "normal",
    notesSummary: "LSA form. Needs claim vs cash conversation. Not receiving LSA ads live — this is a seed.",
    leadLogRowId: "LOG-1048",
  },
  {
    name: "Robert Chen",
    source: "website",
    stage: "assign",
    assignedPm: "raymond",
    phones: ["904-555-0117"],
    email: "robert.chen@example.com",
    address: "3712 Loretto Rd, Jacksonville FL",
    zip: "32223",
    insuranceClaim: false,
    roofAge: "14",
    urgency: "normal",
    notesSummary: "Website estimate request. Retail reroof, Mandarin.",
    leadLogRowId: "LOG-1051",
  },
  {
    name: "Patricia Gaines",
    source: "st-johns-permit",
    stage: "contact",
    assignedPm: "austin",
    phones: ["904-555-0164"],
    email: "patricia.gaines@example.com",
    address: "1842 Palm Valley Rd, Ponte Vedra FL",
    zip: "32081",
    insuranceClaim: true,
    insuranceCarrier: "USAA",
    roofAge: "16",
    urgency: "normal",
    notesSummary: "St. Johns permit pull. Neighbor already filed. Austin first call logged.",
    leadLogRowId: "LOG-1055",
  },
  {
    name: "Darnell Brooks",
    source: "referral",
    stage: "appointment_set",
    assignedPm: "cody",
    phones: ["904-555-0133"],
    email: "darnell.brooks@example.com",
    address: "1248 Ortega Blvd, Jacksonville FL",
    zip: "32210",
    insuranceClaim: true,
    insuranceCarrier: "Travelers",
    roofAge: "20",
    urgency: "storm",
    notesSummary: "Referral from previous Ortega job. Inspection booked in Roofr.",
    leadLogRowId: "LOG-1060",
  },
  {
    name: "Linda Nguyen",
    source: "remodel-favor",
    stage: "inspection",
    assignedPm: "raymond",
    phones: ["904-555-0171"],
    email: "linda.nguyen@example.com",
    address: "401 3rd St, Atlantic Beach FL",
    zip: "32233",
    insuranceClaim: true,
    insuranceCarrier: "Nationwide",
    roofAge: "12",
    urgency: "normal",
    notesSummary: "Remodel Favor parked source — seeded for tracker. Ray walked the roof Tuesday.",
    leadLogRowId: "LOG-1064",
  },
  {
    name: "Kevin O'Reilly",
    source: "fb-lead",
    stage: "proposal",
    assignedPm: "austin",
    phones: ["904-555-0106"],
    email: "kevin.oreilly@example.com",
    address: "7820 Southside Blvd, Jacksonville FL",
    zip: "32256",
    insuranceClaim: true,
    insuranceCarrier: "Florida Peninsula",
    roofAge: "19",
    urgency: "normal",
    notesSummary: "Scope in Roofr. Waiting on adjuster supplement.",
    leadLogRowId: "LOG-1070",
  },
  {
    name: "Sharon Ellis",
    source: "dream-home",
    stage: "negotiate",
    assignedPm: "cody",
    phones: ["904-555-0188"],
    email: "sharon.ellis@example.com",
    address: "301 1st St N, Jacksonville Beach FL",
    zip: "32250",
    insuranceClaim: true,
    insuranceCarrier: "Progressive",
    roofAge: "25",
    urgency: "normal",
    notesSummary: "Dream Home Club purchase. Deductible conversation in progress.",
    leadLogRowId: "LOG-1077",
  },
  {
    name: "Thomas Harrell",
    source: "gbp-review",
    stage: "lost_nurture",
    assignedPm: "raymond",
    phones: ["904-555-0122"],
    email: "thomas.harrell@example.com",
    address: "2550 Mayport Rd, Atlantic Beach FL",
    zip: "32233",
    insuranceClaim: false,
    roofAge: "8",
    urgency: "low",
    notesSummary: "Price shopper. Nurture in 90 days.",
    result: "lost",
    reasonCode: "price",
    leadLogRowId: "LOG-1081",
  },
  {
    name: "Angela Ruiz",
    source: "zeus-hail",
    stage: "capture",
    assignedPm: null,
    phones: ["904-555-0155"],
    email: "angela.ruiz@example.com",
    address: "6700 Fort Caroline Rd, Jacksonville FL",
    zip: "32277",
    insuranceClaim: true,
    insuranceCarrier: "Allstate",
    roofAge: "15",
    urgency: "storm",
    notesSummary: "Possible hail. Zeus weather is parked — seed only.",
    leadLogRowId: "LOG-1088",
  },
];

async function main() {
  await prisma.activity.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.assignmentEvent.deleteMany();
  await prisma.opportunityLink.deleteMany();
  await prisma.webhookEvent.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.user.deleteMany();
  await prisma.roundRobinCursor.deleteMany();

  await prisma.user.createMany({
    data: [
      ...STAFF_DIRECTORY,
      {
        email: firstmateEmail(),
        name: "Firstmate",
        slug: "firstmate",
        role: "firstmate",
        inRrPool: false,
      },
    ],
  });

  await prisma.roundRobinCursor.create({
    data: { id: "default", lastIndex: 2 },
  });

  for (const row of leads) {
    const lead = await prisma.lead.create({
      data: {
        name: row.name,
        source: row.source,
        stage: row.stage,
        assignedPm: row.assignedPm,
        phones: JSON.stringify(row.phones),
        email: row.email,
        address: row.address,
        zip: row.zip,
        insuranceClaim: row.insuranceClaim,
        insuranceCarrier: row.insuranceCarrier ?? null,
        roofAge: row.roofAge,
        urgency: row.urgency,
        notesSummary: row.notesSummary,
        leadLogRowId: row.leadLogRowId,
        result: "result" in row ? row.result : null,
        reasonCode: "reasonCode" in row ? row.reasonCode : null,
      },
    });

    await prisma.activity.create({
      data: {
        leadId: lead.id,
        type: "note",
        actor: "human",
        actorName: "Firstmate",
        summary: "Seeded from MRS Lead Log (Phase 1 sample).",
      },
    });

    if (row.assignedPm) {
      await prisma.assignmentEvent.create({
        data: {
          leadId: lead.id,
          fromPm: null,
          toPm: row.assignedPm,
          reason: "rr_auto",
          actor: "seed",
        },
      });
    }

    if (row.name === "Patricia Gaines") {
      await prisma.activity.create({
        data: {
          leadId: lead.id,
          type: "call",
          direction: "outbound",
          actor: "human",
          actorName: "Austin Maddox",
          outcome: "voicemail",
          summary: "First call — left voicemail, will try after 5.",
        },
      });
    }

    if (row.name === "Darnell Brooks") {
      await prisma.appointment.create({
        data: {
          leadId: lead.id,
          startsAt: new Date("2026-09-22T15:00:00-04:00"),
          endsAt: new Date("2026-09-22T16:00:00-04:00"),
          assignee: "cody",
          roofrCalendarId: "roofr-cal-demo-1060",
          status: "set",
          notes: "Booked in Roofr. Tracker is display only.",
        },
      });
      await prisma.opportunityLink.create({
        data: {
          leadId: lead.id,
          roofrId: "RF-88421",
          mrsJobId: null,
        },
      });
    }

    if (row.name === "Kevin O'Reilly") {
      await prisma.opportunityLink.create({
        data: {
          leadId: lead.id,
          roofrId: "RF-77910",
          mrsJobId: null,
        },
      });
    }
  }

  await prisma.webhookEvent.create({
    data: {
      source: "website",
      payload: JSON.stringify({
        name: "Test Website Lead",
        phone: "904-555-0000",
        message: "Example inbound form — stored only.",
      }),
      note: "stored_only",
    },
  });

  if (process.env.NODE_ENV !== "production") {
    const rayUser = await prisma.user.findUnique({ where: { email: "ray@mrsroofers.com" } });
    if (rayUser) {
      const crypto = await import("crypto");
      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await prisma.user.update({
        where: { id: rayUser.id },
        data: {
          inviteTokenHash: tokenHash,
          inviteExpiresAt: expiresAt,
        },
      });
      console.log("\n[Bootstrap] Owner invite link generated for ray@mrsroofers.com (non-production seed):");
      console.log(`  http://localhost:43177/invite/${token}\n`);
    }
  }

  console.log("Seeded 10 Jacksonville leads, staff directory, and webhook sample.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
