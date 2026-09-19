import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { WEBHOOK_SOURCES } from "@/lib/sources";

export const dynamic = "force-dynamic";

export default async function WebhookInboxPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const events = await prisma.webhookEvent.findMany({
    orderBy: { receivedAt: "desc" },
    take: 80,
  });

  return (
    <AppShell
      userName={session.user.name ?? "Staff"}
      userEmail={session.user.email ?? ""}
      pathname="/admin/webhooks"
    >
      <h1 className="font-serif text-3xl">Webhook inbox</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Store-only stubs. POST to these URLs does not create leads, send SMS, or touch Roofr.
      </p>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        {WEBHOOK_SOURCES.map((source) => (
          <code key={source} className="rounded-md bg-[#efe8da] px-2 py-1">
            POST /api/webhooks/{source}
          </code>
        ))}
      </div>

      {events.length === 0 ? (
        <Card className="mt-6 p-8 text-center text-sm text-muted">
          No payloads yet. Send a test POST to any stub URL — it will land here and do nothing else.
        </Card>
      ) : (
        <div className="mt-6 space-y-3">
          {events.map((event) => (
            <Card key={event.id} className="p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium">{event.source}</p>
                <p className="text-xs text-muted">
                  {formatDateTime(event.receivedAt)} · {event.note}
                </p>
              </div>
              <pre className="mt-3 overflow-x-auto rounded-md bg-[#1a2332] p-3 text-[11px] leading-relaxed text-[#f3eee4]">
                {pretty(event.payload)}
              </pre>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}

function pretty(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}
