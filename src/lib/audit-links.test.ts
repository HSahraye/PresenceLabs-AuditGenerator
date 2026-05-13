import { buildSignedAuditPath, createAuditAccessToken, verifyAuditAccessToken } from "./audit-links";

describe("audit link signing", () => {
  beforeAll(() => {
    process.env.DATABASE_URL = process.env.DATABASE_URL || "file:./dev.db";
  });

  it("creates and verifies token for lead id", () => {
    const token = createAuditAccessToken("lead_123", 120);
    expect(verifyAuditAccessToken(token, "lead_123")).toBe(true);
    expect(verifyAuditAccessToken(token, "lead_other")).toBe(false);
  });

  it("builds signed path", () => {
    const path = buildSignedAuditPath("lead_1");
    expect(path.startsWith("/audit/lead_1?token=")).toBe(true);
  });
});
