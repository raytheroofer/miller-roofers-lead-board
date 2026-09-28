import { STAGE_LABELS, type Stage } from "@/lib/stages";
import { cn } from "@/lib/utils";

const TONE: Record<Stage, string> = {
  capture: "bg-gold-soft text-ink",
  qualify: "bg-[#d7e6ea] text-[#0a343c]",
  assign: "bg-navy text-white",
  contact: "bg-[#f6e7c1] text-[#6a4a10]",
  appointment_set: "bg-[#dceee4] text-[#145c45]",
  inspection: "bg-[#d3e4e8] text-[#0e4a54]",
  proposal: "bg-gold-soft text-[#6a4a10]",
  negotiate: "bg-[#efe4c8] text-ink",
  won: "bg-[#d8efe3] text-[#145c45]",
  lost_nurture: "bg-[#e7e4df] text-muted",
};

export function StageBadge({ stage }: { stage: string }) {
  const label = STAGE_LABELS[stage as Stage] ?? stage;
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
        TONE[stage as Stage] ?? "bg-gold-soft text-ink",
      )}
    >
      {label}
    </span>
  );
}
