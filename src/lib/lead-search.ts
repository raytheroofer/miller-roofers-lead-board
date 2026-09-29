import { parseJsonArray } from "@/lib/utils";

type SearchableLead = {
  name: string; email: string | null; address: string | null; zip: string | null; phones: string;
  opportunity?: { roofrId: string | null } | null;
};

const textKey = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
const phoneKey = (value: string) => value.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");

export function matchesLeadSearch(lead: SearchableLead, query: string) {
  const text = textKey(query);
  if (!text) return true;
  if ([lead.name, lead.email, lead.address, lead.zip, lead.opportunity?.roofrId]
    .some(value => value && textKey(value).includes(text))) return true;
  const phones = parseJsonArray(lead.phones);
  if (phones.some(phone => textKey(phone).includes(text))) return true;
  const digits = phoneKey(query);
  return /^[\d\s()+.\-]+$/.test(query.trim()) && digits.length >= 3 &&
    phones.some(phone => phoneKey(phone).includes(digits));
}
