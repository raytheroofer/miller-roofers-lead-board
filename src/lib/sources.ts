export const LEAD_SOURCES = [
  "zeus-wind",
  "zeus-hail",
  "st-johns-permit",
  "remodel-favor",
  "lsa",
  "fb-lead",
  "dream-home",
  "referral",
  "gbp-review",
  "website",
  "other",
] as const;

export type LeadSource = (typeof LEAD_SOURCES)[number];

export const SOURCE_LABELS: Record<LeadSource, string> = {
  "zeus-wind": "Zeus Wind",
  "zeus-hail": "Zeus Hail",
  "st-johns-permit": "St. Johns Permit",
  "remodel-favor": "Remodel Favor",
  lsa: "Google LSA",
  "fb-lead": "Facebook Lead",
  "dream-home": "Dream Home Club",
  referral: "Referral",
  "gbp-review": "GBP / Review",
  website: "Website",
  other: "Other",
};

export function isLeadSource(value: string): value is LeadSource {
  return (LEAD_SOURCES as readonly string[]).includes(value);
}

export function sourceLabel(value: string): string {
  if (isLeadSource(value)) return SOURCE_LABELS[value];
  return value;
}

export const WEBHOOK_SOURCES = [
  "website",
  "twilio",
  "lsa",
  "ghl",
  "remodel_favor",
] as const;

export type WebhookSource = (typeof WEBHOOK_SOURCES)[number];

export function isWebhookSource(value: string): value is WebhookSource {
  return (WEBHOOK_SOURCES as readonly string[]).includes(value);
}
