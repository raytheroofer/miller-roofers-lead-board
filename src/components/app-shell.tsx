import Link from "next/link";
import { signOut } from "@/auth";
import { featureFlags } from "@/lib/flags";

const NAV = [
  { href: "/", label: "Board" },
  { href: "/leads/new", label: "New lead" },
  { href: "/import", label: "CSV import" },
  { href: "/calendar", label: "Calendar" },
  { href: "/admin/team", label: "Team & Invites" },
  { href: "/admin/webhooks", label: "Webhooks" },
];

export function AppShell({
  children,
  userName,
  userEmail,
  pathname,
}: {
  children: React.ReactNode;
  userName: string;
  userEmail: string;
  pathname: string;
}) {
  const flags = featureFlags();

  return (
    <div className="min-h-full">
      <header className="border-b border-black/20 bg-navy text-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <p className="font-serif text-lg leading-none tracking-tight">Mrs Roofers</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-white/60">
              Miller Roofing Solutions LLC · Jacksonville
            </p>
          </div>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  pathname === item.href ? "bg-white/12 text-white" : "text-white/70 hover:bg-white/8 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-right">
            <div className="hidden sm:block">
              <p className="text-sm">{userName}</p>
              <p className="text-[11px] text-white/55">{userEmail}</p>
            </div>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button className="rounded-md border border-white/20 px-2.5 py-1 text-xs text-white/80 hover:bg-white/10">
                Sign out
              </button>
            </form>
          </div>
        </div>
        <div className="bg-copper px-4 py-1.5 text-center text-[12px] text-white">
          Phase 1 — <strong>track only</strong>. Twilio live: {flags.twilioLive ? "ON" : "OFF"}. Roofr write:{" "}
          {flags.roofrWrite ? "ON" : "OFF"}. Calendar source of truth: Roofr (display only). Digests → Firstmate.
        </div>
      </header>
      <nav className="flex gap-2 overflow-x-auto border-b border-line bg-card px-4 py-2 md:hidden">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-sm ${
              pathname === item.href ? "bg-navy text-white" : "bg-[#efe8da] text-ink"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <main className="mx-auto max-w-[1500px] px-4 py-5">{children}</main>
    </div>
  );
}
