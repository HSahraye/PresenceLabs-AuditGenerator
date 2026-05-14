import { describe, expect, it } from "vitest";
import { stripeSubscriptionStatus, workspaceStatusFromSubscription } from "./subscriptions";

describe("subscription transitions", () => {
  it("maps stripe statuses to internal statuses", () => {
    expect(stripeSubscriptionStatus("active")).toBe("active");
    expect(stripeSubscriptionStatus("past_due")).toBe("past_due");
    expect(stripeSubscriptionStatus("canceled")).toBe("canceled");
  });

  it("marks workspace delinquent when subscription past due", () => {
    expect(workspaceStatusFromSubscription({ subscriptionStatus: "past_due" })).toBe("delinquent");
  });

  it("keeps workspace active for active subscriptions", () => {
    expect(workspaceStatusFromSubscription({ subscriptionStatus: "active" })).toBe("active");
  });
});
