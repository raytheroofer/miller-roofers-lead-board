import Link from "next/link";
import { signOut } from "@/auth";
import { BrandMark } from "@/components/brand-mark";
import { featureFlags } from "@/lib/flags";

const NAV = [
  { href: "/", label: "Board" },
  { href: "/leads/new", label: "New lead" },
  { href: "/import", label: "CSV import" },
  { href: "/calendar", label: "Calendar" },
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
      <header className="border-b border-white/10 bg-ink text-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <BrandMark className="h-12 w-12 shrink-0" />
            <span className="min-w-0">
              <span className="block font-serif text-lg leading-none tracking-tight">Miller Roofing Solutions</span>
              <span className="mt-1 block text-[11px] uppercase tracking-[0.16em] text-gold">
                Mrs Roofers · Jacksonville
              </span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                  pathname === item.href ? "bg-gold text-ink" : "text-gold hover:bg-white/10 hover:text-white"
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
              <button className="rounded-md border border-gold/40 px-2.5 py-1 text-xs font-semibold text-gold hover:bg-gold hover:text-ink">
                Sign out
              </button>
            </form>
          </div>
        </div>
        <div className="bg-gold px-4 py-1.5 text-center text-[12px] font-semibold text-ink">
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
              pathname === item.href ? "bg-ink text-gold" : "bg-paper text-ink"
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
