import { InputError } from "@/lib/input-error";
const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

export function easternInput(value: Date | null): string {
  if (!value) return "";
  const parts = Object.fromEntries(formatter.formatToParts(value).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Reject missing/ambiguous DST wall times rather than silently moving appointments. */
export function parseEasternInput(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new InputError("Enter a date and time in Eastern Time.");
  const matches = ["-04:00", "-05:00"].map(offset => new Date(`${value}:00${offset}`))
    .filter(date => Number.isFinite(date.getTime()) && easternInput(date) === value);
  if (matches.length !== 1) throw new InputError("This Eastern Time is missing or ambiguous because of daylight saving time. Choose another time.");
  return matches[0];
}
