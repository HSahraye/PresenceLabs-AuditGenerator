import { verifyHmacSignature } from "./request-security";
import crypto from "node:crypto";

describe("request signature verification", () => {
  it("validates matching signatures", () => {
    const body = "1710000000000.{\"a\":1}";
    const secret = "test-secret";
    const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");
    expect(
      verifyHmacSignature({
        rawBody: body,
        providedSignature: sig,
        secret,
      }),
    ).toBe(true);
  });

  it("rejects invalid signature", () => {
    expect(
      verifyHmacSignature({
        rawBody: "body",
        providedSignature: "bad",
        secret: "x",
      }),
    ).toBe(false);
  });
});
