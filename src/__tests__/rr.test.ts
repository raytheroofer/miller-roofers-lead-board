import { describe, expect, it } from "vitest";
import { RR_POOL, RR_CURSOR_ID, assertAssignablePm, isRrPm, nextRoundRobin, previewRoundRobinOrder, pmLabel } from "@/lib/rr";

describe("current routing roster", () => {
  it("alternates Raymond and Cody and isolates the old three-person cursor", () => {
    expect([...RR_POOL]).toEqual(["raymond", "cody"]);
    expect(RR_CURSOR_ID).not.toBe("default");
    expect(nextRoundRobin(-1)).toEqual({ pm: "raymond", nextIndex: 0 });
    expect(nextRoundRobin(0)).toEqual({ pm: "cody", nextIndex: 1 });
    expect(nextRoundRobin(1)).toEqual({ pm: "raymond", nextIndex: 0 });
    expect(previewRoundRobinOrder(-1, 6)).toEqual(["raymond", "cody", "raymond", "cody", "raymond", "cody"]);
  });
  it.each(["austin", "chris", "chris_bell", "firstmate"])("rejects new assignment to %s", pm => {
    expect(isRrPm(pm)).toBe(false);
    expect(() => assertAssignablePm(pm)).toThrow();
  });
  it("keeps historical staff labels without making them assignable", () => {
    expect(pmLabel("austin")).toBe("Austin Maddox (inactive)");
    expect(pmLabel("cody")).toBe("Cody Boyd");
    expect(() => assertAssignablePm("cody")).not.toThrow();
  });
});
