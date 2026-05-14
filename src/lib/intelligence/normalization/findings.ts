import type { CollectedSignals, Finding, LeadIntelligence } from "@/lib/intelligence/types";

export function splitFindings(findings: Finding[]): LeadIntelligence["findings"] {
  return {
    technical: findings.filter((item) => item.category === "technical" || item.category === "accessibility"),
    seo: findings.filter((item) => item.category === "seo"),
    conversion: findings.filter((item) => item.category === "conversion" || item.category === "branding"),
    trust: findings.filter((item) => item.category === "trust"),
  };
}

export function deriveStrengths(signals: CollectedSignals): string[] {
  const strengths: string[] = [];
  if (signals.hasHttps) strengths.push("Website uses HTTPS");
  if (signals.hasCta) strengths.push("Clear conversion CTA language exists");
  if (signals.hasContactInfo) strengths.push("Contact details are visible");
  if (signals.hasReviewSignals) strengths.push("Review/testimonial signals detected");
  if (signals.hasSchemaMarkup) strengths.push("Structured data markup detected");
  if (signals.hasViewportMeta) strengths.push("Mobile viewport metadata exists");
  return strengths.slice(0, 6);
}

export function derivePainPoints(findings: Finding[]): string[] {
  return findings
    .filter((item) => item.severity !== "info")
    .map((item) => item.title)
    .slice(0, 8);
}
