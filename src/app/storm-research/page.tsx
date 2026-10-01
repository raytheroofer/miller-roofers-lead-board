import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { ZeusUpload } from "@/components/zeus-upload";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function StormResearchPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "owner") notFound();
  const [total, flagged, rows] = await Promise.all([
    prisma.stormObservation.count(),
    prisma.stormObservation.count({ where: { quarantineReason: { not: null } } }),
    prisma.stormObservation.findMany({
      where: { quarantineReason: null }, orderBy: [{ stormDate: "desc" }, { hailIn: "desc" }], take: 50,
    }),
  ]);
  return <AppShell userName={session.user.name ?? "Owner"} userEmail={session.user.email ?? ""} pathname="/storm-research">
    <h1 className="text-3xl font-semibold text-navy">Zeus storm research</h1>
    <p className="mt-2 max-w-3xl text-sm text-muted">Owner-only research queue. ZIP/day observations are modeled storm signals, not unique homes, roof measurements, confirmed damage, or customer leads. Nothing here creates outreach or a Roofr job.</p>
    <div className="mt-5 rounded-xl border border-line bg-card p-5">
      <p className="font-semibold">{total.toLocaleString()} saved observations · {flagged.toLocaleString()} flagged ZIPs · 0 customer leads created by this import</p>
      <ZeusUpload />
    </div>
    <div className="mt-5 overflow-x-auto rounded-xl border border-line bg-card p-5">
      <h2 className="mb-3 text-lg font-semibold">Recent observations for property research</h2>
      <table className="w-full text-left text-sm"><thead><tr className="border-b border-line"><th className="p-2">Date</th><th className="p-2">Area</th><th className="p-2">Modeled hazard</th><th className="p-2">Homes estimate</th><th className="p-2">Evidence</th></tr></thead>
        <tbody>{rows.map(row => <tr className="border-b border-line" key={row.id}>
          <td className="p-2">{row.stormDate.toISOString().slice(0, 10)}</td>
          <td className="p-2">{row.city}, {row.county} · {row.zip}</td>
          <td className="p-2">{row.hailIn == null ? "" : `${row.hailIn} in hail `}{row.windMph == null ? "" : `${row.windMph} mph wind`}{row.preliminary ? " · Preliminary" : ""}</td>
          <td className="p-2">{row.homesAffected?.toLocaleString() ?? "Unknown"} (not unique leads)</td>
          <td className="p-2">{row.swathUrl ? <a href={row.swathUrl} target="_blank" rel="noopener noreferrer" className="underline">Open swath</a> : "No link"}</td>
        </tr>)}</tbody></table>
      {rows.length === 0 && <p className="mt-3 text-sm text-muted">No snapshot imported yet.</p>}
    </div>
    <p className="mt-5 max-w-3xl text-sm">Next step: verify a specific property address, roof evidence, exposure and a real contact or inquiry in its original source. Search the board for duplicates before capturing that property as a lead. Do not promote aggregate counts or quarantined ZIPs.</p>
  </AppShell>;
}
