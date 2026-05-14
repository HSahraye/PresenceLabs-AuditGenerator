import { describe, expect, it } from "vitest";
import { validateSequenceSteps } from "./validation";

describe("sequence step validation", () => {
  it("accepts valid sequence config", () => {
    const result = validateSequenceSteps([
      {
        name: "Intro email",
        channel: "email",
        delayMinutes: 0,
        contentTemplate: "Hi {{ownerName}} from {{businessName}}",
        approvalRequired: true,
        subject: "Quick follow-up for {{businessName}}",
      },
    ]);
    expect(result.ok).toBe(true);
  });

  it("rejects unsupported template variables", () => {
    const result = validateSequenceSteps([
      {
        name: "Bad template",
        channel: "sms",
        delayMinutes: 0,
        contentTemplate: "Hi {{notAllowed}}",
      },
    ]);
    expect(result.ok).toBe(false);
  });

  it("rejects invalid delays", () => {
    const result = validateSequenceSteps([
      {
        name: "Negative delay",
        channel: "task",
        delayMinutes: -1,
        contentTemplate: "Call {{businessName}}",
      },
    ]);
    expect(result.ok).toBe(false);
  });
});
