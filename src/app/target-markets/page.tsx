import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { prisma } from "@/lib/prisma";
import { PRIMARY_MARKETS, PRIMARY_ZIPS, marketSummary, STORM_RESEARCH_ORDER } from "@/lib/marketing-targets";
import { getTargetWeather } from "@/lib/target-weather";
import { sourceLabel } from "@/lib/sources";

export const dynamic = "force-dynamic";

export default async function TargetMarketsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "owner") notFound();
  const now = new Date();
  const [weather, research, leads] = await Promise.all([
    getTargetWeather(now),
    prisma.stormObservation.findMany({ where: { zip: { in: PRIMARY_ZIPS }, quarantineReason: null },
      orderBy: STORM_RESEARCH_ORDER, take: 1001 }).catch(() => null),
    prisma.lead.findMany({ select: { zip: true, source: true, stage: true, name: true, email: true, leadLogRowId: true } }).catch(() => null),
  ]);
  const researchComplete = research !== null && research.length <= 1000;
  const summaries = PRIMARY_MARKETS.map(market => ({ ...market, summary: marketSummary(market.zip, research ?? [], leads ?? [], now) }));
  const prioritized = summaries.filter(market => weather.find(county => county.code === market.countyCode)?.alerts.length);
  return <AppShell userName={session.user.name ?? "Owner"} userEmail={session.user.email ?? ""} pathname="/target-markets">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-widest text-navy">Lead generation territory</p>
        <h1 className="mt-2 text-3xl font-semibold text-navy">Target ZIPs & storm opportunities</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">Seven owner-selected ZIPs, in priority order. Use weather to choose where to investigate, then capture a specific customer inquiry. Storm signals do not create leads or prove roof damage.</p>
      </div>
      <a className="rounded-md border border-line bg-card px-4 py-2 text-sm" href="/api/marketing-targets">Download target ZIPs</a>
    </div>
    <section className="mt-6 rounded-xl border border-line bg-card p-5">
      <h2 className="text-lg font-semibold">Current weather review</h2>
      <p className="mt-2 text-sm">{prioritized.length ? `Review county alerts before planning visits in ${prioritized.map(m => m.zip).join(", ")}.` : "No current roofing-weather alert signal is available to prioritize a ZIP. Keep the territory order below."} Follow official safety guidance; schedule field visits after unsafe conditions pass.</p>
      <p className="mt-2 text-xs text-muted">National Weather Service county context supplements saved Zeus research. County coverage can include areas outside a target ZIP. No alert is not proof that a storm or damage did not occur. Responses refresh on visits with up to five minutes of caching.</p>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">{weather.map(county => <div className="rounded-lg border border-line p-4" key={county.code}>
        <h3 className="font-semibold">{county.name} County</h3>
        <p className="mt-1 text-sm">{county.state === "unavailable" ? "Weather check unavailable — verify the official source." : county.alerts.length ? `${county.alerts.length} active wind / storm alerts` : "No active wind / storm alerts returned."}</p>
        {county.responseAt && <p className="mt-1 text-xs text-muted">Response: {county.responseAt.toLocaleString("en-US", { timeZone: "America/New_York" })} ET</p>}
        {county.alerts.map(alert => <details className="mt-3 rounded-md bg-paper p-3 text-sm" key={alert.id}>
          <summary className="cursor-pointer font-semibold">{alert.event}</summary><p className="mt-2">{alert.headline}</p>
          <p className="mt-2 text-muted">Coverage: {alert.area}</p><p className="mt-2 whitespace-pre-line">{alert.response}</p>
          <p className="mt-2 text-xs">Expires {alert.expires.toLocaleString("en-US", { timeZone: "America/New_York" })} ET</p>
        </details>)}
        <a className="mt-3 inline-block text-sm underline" target="_blank" rel="noopener noreferrer" href={`https://api.weather.gov/alerts/active?zone=${county.code}`}>Open official county alert feed</a>
      </div>)}</div>
    </section>
    {!researchComplete && <p role="status" className="mt-4 rounded-lg border border-line bg-card p-4 text-sm">{research === null ? "Zeus research storage is unavailable; do not interpret this as zero observations." : "Research exceeds the view limit; summaries are partial. Use Storm research before making a decision."}</p>}
    {leads === null && <p role="status" className="mt-4 rounded-lg border border-line bg-card p-4 text-sm">Lead counts are unavailable, not zero.</p>}
    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{summaries.map((market, index) => <section key={market.zip} className="rounded-xl border border-line bg-card p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted">Priority {index + 1} · {market.county} County context</p>
      <h2 className="mt-2 text-2xl font-semibold text-navy">{market.zip}</h2><p className="text-sm">{market.area}</p>
      <div className="mt-4 border-t border-line pt-3 text-sm">
        <p>{researchComplete ? `${market.summary.observations} saved Zeus observations` : "Zeus coverage not fully verified"}</p>
        {market.summary.latest && <p className="mt-1">Latest event: {market.summary.latest.stormDate.toISOString().slice(0, 10)} · {market.summary.latest.preliminary ? "Preliminary" : "Vendor finalized"}</p>}
        {market.summary.latest && <p className="mt-1 text-xs text-muted">Snapshot captured {market.summary.latest.capturedAt.toISOString().slice(0, 10)}. Historical modeled research; verify current swath and vendor corrections.</p>}
        {researchComplete && <p className="mt-2">{market.summary.finalizedRecent} finalized observations within 30 days · {market.summary.preliminary} preliminary</p>}
        <p className="mt-3">{leads === null ? "Lead counts unavailable" : `${market.summary.leads} working leads · ${market.summary.open} open · ${market.summary.won} won`}</p>
        {!!market.summary.bySource.length && <p className="mt-1 text-xs text-muted">{market.summary.bySource.map(([source, count]) => `${sourceLabel(source)} ${count}`).join(" · ")}</p>}
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <Link className="underline" href={`/storm-research?zip=${market.zip}`}>Review Zeus evidence</Link>
        <Link className="underline" href={`/?view=table&zip=${market.zip}`}>Review leads</Link>
        <Link className="rounded-md bg-navy px-3 py-2 text-white" href={`/leads/new?zip=${market.zip}`}>Capture verified inquiry</Link>
      </div>
    </section>)}</div>
    <section className="mt-6 rounded-xl border border-line bg-card p-5 text-sm">
      <h2 className="text-lg font-semibold">Use across lead sources</h2>
      <p className="mt-2">Use the same seven ZIPs for website, Roofr, LSA, Facebook and paid-provider territory setup. Provider advertising and territory updates remain pending. Check connection and delivery status on <Link href="/sources" className="underline">Lead sources</Link>.</p>
      <p className="mt-2">For each opportunity: verify the property and storm evidence, establish a real contact or inquiry, check for duplicates, capture the actual source and assign the next action. Keep job and appointment records in Roofr. Additional ZIP suggestions are not active targets.</p>
    </section>
  </AppShell>;
}
