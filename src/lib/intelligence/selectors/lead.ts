import { computeLeadMomentum } from "@/lib/intelligence/momentum/engine";
import type { LeadIntelligence } from "@/lib/intelligence/types";
import type { AuditChecks, GeneratedAssets } from "@/lib/types";

export type LeadPriorityState = "HOT" | "RISING" | "STALE" | "COOLING" | "HIGH_INTENT" | "REENGAGE" | "PAYMENT_READY";
export type LeadHealthState = "healthy" | "at-risk" | "critical";

type AnyLead = {
  intelligenceJson?: string | null;
  auditJson?: string | null;
  assetsJson?: string | null;
  score?: number | null;
  painSummary?: string | null;
  packageName?: string | null;
  viewCount?: number | null;
  paymentClickCount?: number | null;
  lastViewedAt?: string | Date | null;
  lastContactedAt?: string | Date | null;
  createdAt?: string | Date | null;
};

function safeParse<T>(value?: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function fallbackFromLegacy(lead: AnyLead): LeadIntelligence {
  const assets = safeParse<GeneratedAssets>(lead.assetsJson) || null;
  const audit = safeParse<{ checks?: AuditChecks }>(lead.auditJson) || null;
  const checks = audit?.checks;
  const conversionScore = checks
    ? [checks.clearCta, checks.phoneEasyToFind, checks.onlineBooking, checks.serviceList].filter(Boolean).length * 25
    : Math.max(30, (lead.score || 50));
  const trustScore = checks
    ? [checks.hasWebsite, checks.reviewsVisible, checks.trustSection, checks.pricing].filter(Boolean).length * 25
    : Math.max(30, (lead.score || 50));
  const seoScore = checks
    ? [checks.hasWebsite, checks.serviceList, checks.faq, checks.pricing].filter(Boolean).length * 25
    : Math.max(30, (lead.score || 50));
  const accessibilityScore = checks
    ? [checks.mobileFriendly, checks.phoneEasyToFind].filter(Boolean).length * 50
    : 55;
  const brandingScore = checks
    ? [checks.gallery, checks.reviewsVisible, checks.trustSection].filter(Boolean).length * 33
    : 55;
  const performanceScore = checks
    ? [checks.mobileFriendly, checks.hasWebsite].filter(Boolean).length * 50
    : 55;
  const urgencyScore = Math.max(15, 100 - Math.round((conversionScore + trustScore) / 2));
  return {
    scores: {
      seo: Math.max(0, Math.min(100, Math.round(seoScore))),
      performance: Math.max(0, Math.min(100, Math.round(performanceScore))),
      trust: Math.max(0, Math.min(100, Math.round(trustScore))),
      conversion: Math.max(0, Math.min(100, Math.round(conversionScore))),
      accessibility: Math.max(0, Math.min(100, Math.round(accessibilityScore))),
      branding: Math.max(0, Math.min(100, Math.round(brandingScore))),
    },
    painPoints: assets?.painPointSummary ? [assets.painPointSummary] : [lead.painSummary || "Conversion and trust opportunities detected."],
    strengths: [],
    urgencyScore,
    likelyBudget: urgencyScore >= 70 ? "high" : urgencyScore >= 45 ? "medium" : "low",
    recommendedOffer: assets?.recommendedPackage || lead.packageName || "Presence Labs Conversion Upgrade",
    outreachAngles: [],
    objections: [],
    closeProbability: Math.max(5, Math.min(90, Math.round((lead.score || 50) * 0.9))),
    findings: { technical: [], seo: [], conversion: [], trust: [] },
    generatedAt: new Date().toISOString(),
  };
}

export function getLeadIntelligence(lead: AnyLead): LeadIntelligence {
  const parsed = safeParse<LeadIntelligence>(lead.intelligenceJson);
  return parsed ?? fallbackFromLegacy(lead);
}

export function getLeadScores(lead: AnyLead) {
  return getLeadIntelligence(lead).scores;
}

export function getUrgencyLevel(lead: AnyLead) {
  const urgency = getLeadIntelligence(lead).urgencyScore;
  return urgency >= 70 ? "high" : urgency >= 40 ? "medium" : "low";
}

export function getMomentumLevel(lead: AnyLead) {
  const intelligence = getLeadIntelligence(lead);
  const momentum = computeLeadMomentum({
    viewCount: lead.viewCount ?? 0,
    revisitCount: Math.max(0, (lead.viewCount ?? 0) - 1),
    paymentClickCount: lead.paymentClickCount ?? 0,
    outreachRecencyHours: lead.lastContactedAt ? (Date.now() - new Date(lead.lastContactedAt).getTime()) / 3_600_000 : 999,
    statusAgeDays: lead.createdAt ? (Date.now() - new Date(lead.createdAt).getTime()) / 86_400_000 : 0,
  });
  return intelligence.momentumScore
    ? intelligence.momentumScore >= 68
      ? "rising"
      : intelligence.momentumScore >= 38
        ? "stable"
        : "cooling"
    : momentum.engagementTrend;
}

export function getPrimaryPainPoints(lead: AnyLead) {
  return getLeadIntelligence(lead).painPoints.slice(0, 4);
}

export function getRecommendedOffer(lead: AnyLead) {
  return getLeadIntelligence(lead).recommendedOffer;
}

export function getOutreachAngles(lead: AnyLead) {
  return getLeadIntelligence(lead).outreachAngles.slice(0, 5);
}

export function getCloseProbability(lead: AnyLead) {
  return getLeadIntelligence(lead).closeProbability;
}

export function getLeadStrengths(lead: AnyLead) {
  return getLeadIntelligence(lead).strengths.slice(0, 4);
}

export function getLeadPriorityState(lead: AnyLead): LeadPriorityState {
  const urgency = getLeadIntelligence(lead).urgencyScore;
  const momentum = getMomentumLevel(lead);
  if ((lead.paymentClickCount ?? 0) > 0) return "PAYMENT_READY";
  if ((lead.viewCount ?? 0) >= 2 && urgency >= 60) return "HIGH_INTENT";
  if (momentum === "rising" && urgency >= 60) return "HOT";
  if (momentum === "rising") return "RISING";
  if (momentum === "cooling" && (lead.viewCount ?? 0) > 0) return "REENGAGE";
  if (momentum === "cooling") return "COOLING";
  return "STALE";
}

export function getLeadHealthState(lead: AnyLead): LeadHealthState {
  const scores = getLeadScores(lead);
  const avg = (scores.conversion + scores.trust + scores.seo) / 3;
  if (avg < 45) return "critical";
  if (avg < 68) return "at-risk";
  return "healthy";
}
