import { describe, expect, it } from "vitest";
import {
  RR_EXCLUDED,
  RR_POOL,
  assertAssignablePm,
  isRrPm,
  nextRoundRobin,
  previewRoundRobinOrder,
} from "@/lib/rr";

describe("round-robin pool", () => {
  it("only includes Raymond → Austin → Cody", () => {
    expect([...RR_POOL]).toEqual(["raymond", "austin", "cody"]);
    expect(RR_POOL).toHaveLength(3);
    expect(isRrPm("chris")).toBe(false);
    expect(isRrPm("chris_bell")).toBe(false);
    expect(RR_EXCLUDED).toContain("chris_bell");
  });

  it("walks Raymond then Austin then Cody then wraps to Raymond", () => {
    expect(nextRoundRobin(-1)).toEqual({ pm: "raymond", nextIndex: 0 });
    expect(nextRoundRobin(0)).toEqual({ pm: "austin", nextIndex: 1 });
    expect(nextRoundRobin(1)).toEqual({ pm: "cody", nextIndex: 2 });
    expect(nextRoundRobin(2)).toEqual({ pm: "raymond", nextIndex: 0 });
  });

  it("never emits Chris Bell across a full cycle", () => {
    const order = previewRoundRobinOrder(-1, 12);
    expect(order).toEqual([
      "raymond",
      "austin",
      "cody",
      "raymond",
      "austin",
      "cody",
      "raymond",
      "austin",
      "cody",
      "raymond",
      "austin",
      "cody",
    ]);
    expect(order.some((pm) => pm.includes("chris"))).toBe(false);
  });

  it("rejects assign to anyone outside the pool", () => {
    expect(() => assertAssignablePm("chris_bell")).toThrow(/out of the routing pool/i);
    expect(() => assertAssignablePm("firstmate")).toThrow(/not in the round-robin pool/i);
    expect(() => assertAssignablePm("austin")).not.toThrow();
  });
});
