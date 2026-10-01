import { timingSafeEqual } from "node:crypto";
import { codyPassword } from "@/lib/cody-access";

export const INTAKE_SOURCES = {
  "remodel-favor": { label: "Remodel Favor", keyEnv: "INTAKE_REMODEL_FAVOR_KEY", source: "remodel-favor", routing: "round-robin" },
  website: { label: "Website", keyEnv: "INTAKE_WEBSITE_KEY", source: "website", routing: "manual" },
  "roofr-instant-estimator": { label: "Roofr Instant Estimator", keyEnv: "INTAKE_ROOFR_KEY", source: "roofr-instant-estimator", routing: "manual" },
  lsa: { label: "Google LSA", keyEnv: "INTAKE_LSA_KEY", source: "lsa", routing: "manual" },
} as const;
export type IntakeSource = keyof typeof INTAKE_SOURCES;
export const INTAKE_SOURCE_IDS = Object.keys(INTAKE_SOURCES) as IntakeSource[];
export function isIntakeSource(value: string): value is IntakeSource {
  return Object.hasOwn(INTAKE_SOURCES, value);
}

// Keys are server-only, distinct per provider, and never returned to the UI.
export function intakeConfiguration(source: IntakeSource): "disabled" | "needs-setup" | "ready" {
  if (!(process.env.LEAD_INTAKE_SOURCES ?? "").split(",").map(v => v.trim()).includes(source)) return "disabled";
  const owner = process.env.OWNER_PASSWORD ?? "";
  if (owner.length < 16 || [process.env.AUTH_PASSWORD, process.env.CODY_PASSWORD, process.env.FIRSTMATE_PASSWORD].includes(owner)) return "needs-setup";
  if (source === "remodel-favor" && !codyPassword()) return "needs-setup";
  const key = process.env[INTAKE_SOURCES[source].keyEnv] ?? "";
  if (!/^[a-f0-9]{64}$/.test(key)) return "needs-setup";
  if ([process.env.OWNER_PASSWORD, process.env.AUTH_PASSWORD, process.env.CODY_PASSWORD,
    process.env.AUTH_SECRET, process.env.NEXTAUTH_SECRET, process.env.FIRSTMATE_PASSWORD].includes(key)) return "needs-setup";
  if (INTAKE_SOURCE_IDS.some(other => other !== source && process.env[INTAKE_SOURCES[other].keyEnv] === key)) return "needs-setup";
  return "ready";
}

export function authorizedIntake(source: IntakeSource, authorization: string | null): boolean {
  if (intakeConfiguration(source) !== "ready") return false;
  const supplied = /^Bearer ([a-f0-9]{64})$/.exec(authorization ?? "")?.[1];
  if (!supplied) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(process.env[INTAKE_SOURCES[source].keyEnv]!));
}
