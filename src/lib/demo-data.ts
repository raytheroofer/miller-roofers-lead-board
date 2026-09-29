// Exact published seed signatures. Never infer demo status from a customer's name alone.
const demoEmails: Record<string, string> = {
  "LOG-1042": "james.whitaker@example.com", "LOG-1048": "maria.delgado@example.com",
  "LOG-1051": "robert.chen@example.com", "LOG-1055": "patricia.gaines@example.com",
  "LOG-1060": "darnell.brooks@example.com", "LOG-1064": "linda.nguyen@example.com",
  "LOG-1070": "kevin.oreilly@example.com", "LOG-1077": "sharon.ellis@example.com",
  "LOG-1081": "thomas.harrell@example.com", "LOG-1088": "angela.ruiz@example.com",
};
export function isDemoLead(lead: { name: string; email: string | null; leadLogRowId: string | null }) {
  return lead.name.startsWith("SYSTEM CHECK —") ||
    Boolean(lead.leadLogRowId && demoEmails[lead.leadLogRowId] === lead.email);
}
