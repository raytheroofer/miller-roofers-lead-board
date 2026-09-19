import { STAGE_LABELS, type Stage } from "@/lib/stages";
import { cn } from "@/lib/utils";

const TONE: Record<Stage, string> = {
  capture: "bg-[#ece6d8] text-[#4a4336]",
  qualify: "bg-[#e4e8d8] text-[#3f4a2f]",
  assign: "bg-[#dce4ef] text-[#2b3d55]",
  contact: "bg-[#f3ddd2] text-[#7a3418]",
  appointment_set: "bg-[#dceee4] text-[#24523b]",
  inspection: "bg-[#d7e6f0] text-[#21445a]",
  proposal: "bg-[#efe3cf] text-[#6a4a16]",
  negotiate: "bg-[#eadcf0] text-[#4c2f58]",
  won: "bg-[#d8efe3] text-[#1f5a3d]",
  lost_nurture: "bg-[#e8e3dc] text-[#5a534a]",
};

export function StageBadge({ stage }: { stage: string }) {
  const label = STAGE_LABELS[stage as Stage] ?? stage;
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
        TONE[stage as Stage] ?? "bg-[#ece6d8] text-[#4a4336]",
      )}
    >
      {label}
    </span>
  );
}
