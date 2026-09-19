import { describe, expect, it } from "vitest";
import {
  STAGES,
  canTransition,
  suggestedNextStage,
} from "@/lib/stages";

describe("stage enum", () => {
  it("matches the locked Phase 1 funnel exactly", () => {
    expect([...STAGES]).toEqual([
      "capture",
      "qualify",
      "assign",
      "contact",
      "appointment_set",
      "inspection",
      "proposal",
      "negotiate",
      "won",
      "lost_nurture",
    ]);
  });
});

describe("stage transitions", () => {
  it("allows forward moves and skips", () => {
    expect(canTransition("capture", "qualify")).toBe(true);
    expect(canTransition("contact", "appointment_set")).toBe(true);
    expect(canTransition("capture", "appointment_set")).toBe(true);
    expect(canTransition("negotiate", "won")).toBe(true);
  });

  it("blocks backward moves without override", () => {
    expect(canTransition("contact", "qualify")).toBe(false);
    expect(canTransition("won", "proposal")).toBe(false);
    expect(canTransition("appointment_set", "capture")).toBe(false);
  });

  it("allows Firstmate/Ray backward override on pipeline stages", () => {
    expect(canTransition("contact", "qualify", { allowBackward: true })).toBe(true);
    expect(canTransition("won", "proposal", { allowBackward: true })).toBe(false);
  });

  it("allows lost_nurture from any live stage and reopen except straight to won", () => {
    expect(canTransition("capture", "lost_nurture")).toBe(true);
    expect(canTransition("proposal", "lost_nurture")).toBe(true);
    expect(canTransition("won", "lost_nurture")).toBe(true);
    expect(canTransition("lost_nurture", "qualify")).toBe(true);
    expect(canTransition("lost_nurture", "contact")).toBe(true);
    expect(canTransition("lost_nurture", "won")).toBe(false);
    expect(canTransition("lost_nurture", "lost_nurture")).toBe(false);
  });

  it("rejects same-stage no-ops and unknown stages", () => {
    expect(canTransition("capture", "capture")).toBe(false);
    expect(canTransition("capture", "hot")).toBe(false);
    expect(canTransition("hot", "qualify")).toBe(false);
  });

  it("suggests the next sequential stage", () => {
    expect(suggestedNextStage("capture")).toBe("qualify");
    expect(suggestedNextStage("assign")).toBe("contact");
    expect(suggestedNextStage("won")).toBeNull();
    expect(suggestedNextStage("lost_nurture")).toBeNull();
  });
});
