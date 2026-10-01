import Link from "next/link";
import { signOut } from "@/auth";
import { featureFlags } from "@/lib/flags";
import { BrandLogo } from "@/components/brand-logo";
import { ownerEmail } from "@/lib/users";

const NAV = [
  { href: "/", label: "Board" },
  { href: "/today", label: "Today" },
  { href: "/leads/new", label: "New lead" },
  { href: "/calendar", label: "Calendar" },
  { href: "/duplicates", label: "Duplicate review" },
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
  const navigation = userEmail.toLowerCase() === ownerEmail() ? [...NAV, { href: "/sources", label: "Lead sources" }, { href: "/storm-research", label: "Storm research" }, { href: "/routing", label: "Lead routing" }] : NAV;

  return (
    <div className="min-h-full">
      <header className="border-t-4 border-gold bg-charcoal text-white">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" aria-label="Miller Roofing Solutions — lead board" className="flex min-w-0 items-center gap-3">
            <BrandLogo />
            <div>
              <p className="text-lg font-semibold leading-tight tracking-tight sm:text-xl">Miller Roofing<br />Solutions</p>
              <p className="mt-1.5 text-[10px] uppercase tracking-[0.18em] text-gold">Lead & follow-up workspace</p>
            </div>
          </Link>
          <nav aria-label="Main navigation" className="hidden items-center gap-1 xl:flex">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  pathname === item.href ? "bg-navy text-white" : "text-white/75 hover:bg-white/8 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-right">
            <div className="hidden md:block">
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
        <div className="border-t border-white/10 bg-navy px-4 py-2 text-center text-xs leading-relaxed text-white">
          <strong>Manual lead tracking</strong><span className="mx-2 text-gold">•</span>Book jobs and appointments in Roofr.
          {flags.twilioLive || flags.roofrWrite ? " Live integrations enabled." : " Calls and messages are logged here; nothing is sent automatically."}
        </div>
      </header>
      <nav aria-label="Compact navigation" className="flex gap-2 overflow-x-auto border-b border-line bg-card px-4 py-2 xl:hidden">
        {navigation.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={pathname === item.href ? "page" : undefined}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-sm ${
              pathname === item.href ? "bg-navy text-white" : "bg-paper text-ink"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <main className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6">{children}</main>
    </div>
  );
}
