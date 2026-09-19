import { cn } from "@/lib/utils";

export function Label({
  children,
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn("mb-1 block text-xs font-medium uppercase tracking-wide text-muted", className)} {...props}>
      {children}
    </label>
  );
}

export function Field({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none ring-copper/30 focus:ring-2",
        className,
      )}
      {...props}
    />
  );
}

export function Area({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none ring-copper/30 focus:ring-2",
        className,
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none ring-copper/30 focus:ring-2",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Button({
  className,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const styles = {
    primary: "bg-navy text-white hover:bg-navy-2",
    secondary: "bg-copper text-white hover:bg-[#9a4320]",
    ghost: "bg-white text-ink border border-line hover:bg-[#f7f1e7]",
    danger: "bg-[#7a2e24] text-white hover:bg-[#5f221c]",
  } as const;

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50",
        styles[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-xl border border-line bg-card shadow-[0_1px_0_rgba(28,25,20,0.04)]", className)}>
      {children}
    </div>
  );
}
