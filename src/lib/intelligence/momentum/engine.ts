export type MomentumInput = {
  viewCount?: number;
  revisitCount?: number;
  paymentClickCount?: number;
  outreachRecencyHours?: number;
  followUpOverdueHours?: number;
  responseCount?: number;
  proposalOpenCount?: number;
  statusAgeDays?: number;
};

export type MomentumOutput = {
  momentumScore: number;
  engagementTrend: "rising" | "stable" | "cooling";
  recommendedAction: string;
  urgencyDelta: number;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function computeLeadMomentum(input: MomentumInput): MomentumOutput {
  const views = input.viewCount ?? 0;
  const revisits = input.revisitCount ?? 0;
  const paymentClicks = input.paymentClickCount ?? 0;
  const responses = input.responseCount ?? 0;
  const proposalOpens = input.proposalOpenCount ?? 0;
  const outreachHours = input.outreachRecencyHours ?? 999;
  const overdueHours = input.followUpOverdueHours ?? 0;
  const ageDays = input.statusAgeDays ?? 0;

  let score = 12;
  score += Math.min(28, views * 4);
  score += Math.min(22, revisits * 5);
  score += Math.min(25, paymentClicks * 12);
  score += Math.min(16, responses * 8);
  score += Math.min(12, proposalOpens * 6);
  if (outreachHours <= 24) score += 8;
  else if (outreachHours > 120) score -= 6;
  if (overdueHours > 48) score -= 10;
  if (ageDays > 21) score -= 8;
  const momentumScore = clamp(score);

  const engagementTrend: MomentumOutput["engagementTrend"] =
    momentumScore >= 68 ? "rising" : momentumScore >= 38 ? "stable" : "cooling";

  let recommendedAction = "Maintain weekly follow-up cadence.";
  if (engagementTrend === "rising") {
    recommendedAction = paymentClicks > 0
      ? "Call now and move toward close while intent is high."
      : "Send direct CTA follow-up within 24h to convert active interest.";
  } else if (engagementTrend === "cooling") {
    recommendedAction = overdueHours > 48
      ? "Re-engage with a short value recap and a clear next-step ask."
      : "Rotate channel (SMS/email/call) and test a stronger urgency hook.";
  }

  const urgencyDelta = engagementTrend === "rising" ? 12 : engagementTrend === "cooling" ? -10 : 0;

  return {
    momentumScore,
    engagementTrend,
    recommendedAction,
    urgencyDelta,
  };
}
