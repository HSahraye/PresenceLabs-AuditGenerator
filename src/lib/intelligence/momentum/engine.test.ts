import { describe, expect, it } from "vitest";
import { computeLeadMomentum } from "./engine";

describe("computeLeadMomentum", () => {
  it("returns rising momentum for high engagement", () => {
    const result = computeLeadMomentum({
      viewCount: 5,
      revisitCount: 3,
      paymentClickCount: 1,
      responseCount: 1,
      outreachRecencyHours: 6,
    });
    expect(result.momentumScore).toBeGreaterThanOrEqual(68);
    expect(result.engagementTrend).toBe("rising");
    expect(result.urgencyDelta).toBeGreaterThan(0);
  });

  it("returns cooling momentum for stale signals", () => {
    const result = computeLeadMomentum({
      viewCount: 0,
      revisitCount: 0,
      paymentClickCount: 0,
      outreachRecencyHours: 140,
      followUpOverdueHours: 80,
      statusAgeDays: 35,
    });
    expect(result.engagementTrend).toBe("cooling");
    expect(result.urgencyDelta).toBeLessThan(0);
  });
});
