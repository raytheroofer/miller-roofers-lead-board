import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/app-shell";
import { LeadBoard } from "@/components/lead-board";
import { isLeadSource, LEAD_SOURCES, SOURCE_LABELS } from "@/lib/sources";
import { isStage, STAGES, STAGE_LABELS } from "@/lib/stages";
import { isRrPm, RR_POOL, RR_POOL_LABELS } from "@/lib/rr";
import { isDemoLead } from "@/lib/demo-data";
import { matchesLeadSearch } from "@/lib/lead-search";

export const dynamic = "force-dynamic";

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; stage?: string; pm?: string; source?: string; records?: string; q?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const params = await searchParams;
  const view = params.view === "table" ? "table" : "board";
  const stage = params.stage && isStage(params.stage) ? params.stage : undefined;
  const pm = params.pm === "austin" || params.pm === "unassigned" || (params.pm && isRrPm(params.pm)) ? params.pm : undefined;
  const source = params.source && isLeadSource(params.source) ? params.source : undefined;
  const search = typeof params.q === "string" ? params.q.trim().slice(0, 200) : "";

  const records = await prisma.lead.findMany({
    where: {
      assignedPm: pm === "unassigned" ? null : pm,
      source,
    },
    include: {
      opportunity: true,
      appointments: { orderBy: { startsAt: "desc" }, take: 1 },
      _count: { select: { activities: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const showDemo = params.records === "demo";
  const population = records.filter(lead => isDemoLead(lead) === showDemo && matchesLeadSearch(lead, search));
  const leads = population.filter(lead => !stage || lead.stage === stage);
  const countByStage = Object.fromEntries(STAGES.map(stage => [stage, population.filter(l => l.stage === stage).length]));

  const query = new URLSearchParams();
  if (view === "table") query.set("view", "table");
  if (stage) query.set("stage", stage);
  if (pm) query.set("pm", pm);
  if (source) query.set("source", source);
  if (search) query.set("q", search);
  if (showDemo) query.set("records", "demo");
  const queryString = query.toString();
  const suffix = queryString ? `?${queryString}` : "";

  return (
    <AppShell
      userName={session.user.name ?? "Staff"}
      userEmail={session.user.email ?? ""}
      pathname="/"
    >
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-bronze">Miller Roofing Solutions</p>
          <h1 className="font-semibold tracking-tight text-3xl text-navy">Lead board</h1>
          <p className="mt-1 text-sm text-muted">
            {leads.length} {showDemo ? "demo / test records" : "working leads"} · Manual updates · Round-robin: Remodel Favor only
          </p>
          <Link href={showDemo ? "/" : "/?records=demo"} className="text-sm underline">{showDemo ? "Show working leads" : "View demo / test records"}</Link>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={toggleView("board", { ...params, q: search })}
            className={`rounded-md px-3 py-2 text-sm ${view === "board" ? "bg-navy text-white" : "border border-line bg-card"}`}
          >
            Board
          </Link>
          <Link
            href={toggleView("table", { ...params, q: search })}
            className={`rounded-md px-3 py-2 text-sm ${view === "table" ? "bg-navy text-white" : "border border-line bg-card"}`}
          >
            Table
          </Link>
        </div>
      </div>

      <form className="mb-5 grid gap-2 rounded-xl border border-line bg-card p-3 sm:grid-cols-4">
        <label className="sm:col-span-4 text-sm">
          Search leads
          <input type="search" name="q" defaultValue={search} maxLength={200}
            placeholder="Name, phone, email, address or Roofr job number"
            className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm" />
        </label>
        <select aria-label="Filter by stage" name="stage" defaultValue={stage ?? ""} className="rounded-md border border-line px-3 py-2 text-sm">
          <option value="">All stages</option>
          {STAGES.map((value) => (
            <option key={value} value={value}>
              {STAGE_LABELS[value]} ({countByStage[value] ?? 0})
            </option>
          ))}
        </select>
        <select aria-label="Filter by project manager" name="pm" defaultValue={pm ?? ""} className="rounded-md border border-line px-3 py-2 text-sm">
          <option value="">All PMs</option>
          <option value="unassigned">Unassigned</option>
          <option value="austin">Austin Maddox — past assignments</option>
          {RR_POOL.map((value) => (
            <option key={value} value={value}>
              {RR_POOL_LABELS[value]}
            </option>
          ))}
        </select>
        <select aria-label="Filter by source" name="source" defaultValue={source ?? ""} className="rounded-md border border-line px-3 py-2 text-sm">
          <option value="">All sources</option>
          {LEAD_SOURCES.map((value) => (
            <option key={value} value={value}>
              {SOURCE_LABELS[value]}
            </option>
          ))}
        </select>
        <input type="hidden" name="view" value={view} />
        {showDemo && <input type="hidden" name="records" value="demo" />}
        <button type="submit" className="rounded-md bg-navy px-3 py-2 text-sm text-white">
          Filter
        </button>
      </form>

      <LeadBoard leads={leads} view={view} query={suffix} />
    </AppShell>
  );
}

function toggleView(
  next: "board" | "table",
  params: { stage?: string; pm?: string; source?: string; records?: string; q?: string },
) {
  const query = new URLSearchParams();
  if (next === "table") query.set("view", "table");
  if (params.stage) query.set("stage", params.stage);
  if (params.pm) query.set("pm", params.pm);
  if (params.source) query.set("source", params.source);
  if (params.q) query.set("q", params.q.trim().slice(0, 200));
  if (params.records === "demo") query.set("records", "demo");
  const text = query.toString();
  return text ? `/?${text}` : "/";
}
