import { collectWebsiteSignals } from "./signals";

describe("collectWebsiteSignals", () => {
  it("returns a deterministic critical finding when website is missing", async () => {
    const result = await collectWebsiteSignals("");
    expect(result.findings.some((finding) => finding.id === "no-website")).toBe(true);
    expect(result.hasCta).toBe(false);
  });
});
