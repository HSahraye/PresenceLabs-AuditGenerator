import { describe, expect, it } from "vitest";
import { renderSequenceTemplate, validateTemplateVariables } from "./template-vars";

describe("sequence template variables", () => {
  it("renders supported variables", () => {
    const rendered = renderSequenceTemplate("Hi {{ownerName}} from {{city}} - {{businessName}}", {
      businessName: "Demo Co",
      ownerName: "Alex",
      city: "San Jose",
    });
    expect(rendered).toContain("Alex");
    expect(rendered).toContain("San Jose");
    expect(rendered).toContain("Demo Co");
  });

  it("detects malformed variables", () => {
    const result = validateTemplateVariables("Hello {{businessName}} {{unknownVar}}");
    expect(result.valid).toBe(false);
    expect(result.unknownVariables).toContain("{{unknownVar}}");
  });
});
