import { validateExternalUrl } from "@/lib/network-safety";
import type { CollectedSignals, Finding } from "@/lib/intelligence/types";

function normalizeUrl(url?: string) {
  if (!url?.trim()) return "";
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function parseTitle(html: string) {
  const match = html.match(/<title[^>]*>([^<]{1,180})<\/title>/i);
  return match?.[1]?.trim() ?? "";
}

function parseMetaDescription(html: string) {
  const match = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,280})["']/i);
  return match?.[1]?.trim() ?? "";
}

function collectFindings(input: {
  normalizedUrl: string;
  html: string;
  statusCode?: number;
  fetchWarnings: string[];
}): Omit<CollectedSignals, "findings"> {
  const lower = input.html.toLowerCase();
  const title = parseTitle(input.html);
  const metaDescription = parseMetaDescription(input.html);
  const hasViewportMeta = /<meta[^>]+name=["']viewport["']/i.test(input.html);
  const hasSchemaMarkup = /application\/ld\+json|itemtype=|itemscope/i.test(input.html);
  const hasSocialLinks = /(facebook\.com|instagram\.com|linkedin\.com|youtube\.com|tiktok\.com)/i.test(input.html);
  const hasReviewSignals = /(review|testimonial|google reviews|rating|stars)/i.test(lower);
  const hasTrustBadges = /(licensed|insured|bbb|guarantee|certified|years in business)/i.test(lower);
  const hasPhonePattern = /(tel:|\(\d{3}\)\s?\d{3}-\d{4}|\d{3}[-.\s]\d{3}[-.\s]\d{4})/.test(input.html);
  const hasEmailPattern = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(input.html);
  const hasContactInfo = hasPhonePattern || hasEmailPattern || /contact us|get in touch/i.test(lower);
  const hasCta = /(book now|schedule|get quote|request quote|call now|contact us|get started)/i.test(lower);
  const hasBookingLanguage = /(book online|appointment|schedule now|reserve)/i.test(lower);
  const hasServiceLanguage = /(services|what we do|our services)/i.test(lower);
  const hasPricingLanguage = /(pricing|price|packages|starting at)/i.test(lower);
  const hasFaqLanguage = /(faq|frequently asked)/i.test(lower);
  const hasGalleryLanguage = /(gallery|portfolio|before and after|projects)/i.test(lower);
  const hasLocalSeoSignals = /(google maps|service area|near me|local)/i.test(lower);
  const hasAccessibilityLangAttr = /<html[^>]+lang=["'][a-z]/i.test(input.html);
  const hasImageAltTextHints = /<img[^>]+alt=["'][^"']+["']/i.test(input.html);
  const hasBrokenAnchorTargets = /href=["']#(?![a-z0-9_-]+["'])/i.test(input.html);
  const bodySize = input.html.length;
  const performanceHint: CollectedSignals["performanceHint"] =
    bodySize < 35_000 ? "good" : bodySize < 120_000 ? "moderate" : "poor";
  const hasHttps = /^https:\/\//i.test(input.normalizedUrl);

  return {
    normalizedUrl: input.normalizedUrl,
    html: input.html,
    statusCode: input.statusCode,
    fetchWarnings: input.fetchWarnings,
    hasHttps,
    hasTitle: Boolean(title),
    title,
    hasMetaDescription: Boolean(metaDescription),
    metaDescription,
    hasViewportMeta,
    hasSchemaMarkup,
    hasBrokenAnchorTargets,
    hasSocialLinks,
    hasReviewSignals,
    hasTrustBadges,
    hasContactInfo,
    hasPhonePattern,
    hasEmailPattern,
    hasCta,
    hasBookingLanguage,
    hasServiceLanguage,
    hasPricingLanguage,
    hasFaqLanguage,
    hasGalleryLanguage,
    hasLocalSeoSignals,
    hasAccessibilityLangAttr,
    hasImageAltTextHints,
    bodySize,
    performanceHint,
  };
}

function findingsFromSignals(signals: Omit<CollectedSignals, "findings">): Finding[] {
  const findings: Finding[] = [];
  if (!signals.normalizedUrl) {
    findings.push({
      id: "no-website",
      category: "technical",
      severity: "critical",
      title: "No website URL provided",
      detail: "A website audit cannot inspect page-level conversion and trust signals without a URL.",
    });
    return findings;
  }
  if (!signals.hasHttps) {
    findings.push({
      id: "http-only",
      category: "trust",
      severity: "critical",
      title: "Site is not using HTTPS",
      detail: "Modern browsers flag non-HTTPS pages, reducing trust and conversions.",
    });
  }
  if (!signals.hasTitle || signals.title.length < 12) {
    findings.push({
      id: "weak-title",
      category: "seo",
      severity: "warning",
      title: "Page title is missing or weak",
      detail: "Search snippets rely on strong titles to drive click-through from local intent traffic.",
      evidence: signals.title || "none",
    });
  }
  if (!signals.hasMetaDescription) {
    findings.push({
      id: "missing-meta-description",
      category: "seo",
      severity: "warning",
      title: "Meta description not found",
      detail: "Missing descriptions reduce control over SERP messaging and lower click-through intent quality.",
    });
  }
  if (!signals.hasCta) {
    findings.push({
      id: "no-clear-cta",
      category: "conversion",
      severity: "critical",
      title: "No clear call to action",
      detail: "Visitors need an obvious next step (call, quote, schedule) to convert.",
    });
  }
  if (!signals.hasContactInfo) {
    findings.push({
      id: "contact-hard-to-find",
      category: "conversion",
      severity: "critical",
      title: "Contact info not clearly visible",
      detail: "High-intent prospects abandon quickly if phone/email is not obvious.",
    });
  }
  if (!signals.hasTrustBadges || !signals.hasReviewSignals) {
    findings.push({
      id: "weak-trust-layer",
      category: "trust",
      severity: "warning",
      title: "Trust proof is limited",
      detail: "Testimonials, reviews, badges, and guarantees help reduce buyer hesitation.",
    });
  }
  if (!signals.hasViewportMeta) {
    findings.push({
      id: "mobile-readiness",
      category: "technical",
      severity: "warning",
      title: "Mobile viewport metadata missing",
      detail: "Mobile users may get a broken layout, harming local conversion rates.",
    });
  }
  if (signals.performanceHint === "poor") {
    findings.push({
      id: "heavy-page",
      category: "technical",
      severity: "warning",
      title: "Page payload appears heavy",
      detail: "Large HTML payload hints at poor performance and slower time-to-interaction.",
      evidence: `HTML length ${signals.bodySize}`,
    });
  }
  if (!signals.hasSchemaMarkup) {
    findings.push({
      id: "missing-schema",
      category: "seo",
      severity: "info",
      title: "Structured data not detected",
      detail: "Schema can improve local visibility and search context.",
    });
  }
  if (!signals.hasAccessibilityLangAttr || !signals.hasImageAltTextHints) {
    findings.push({
      id: "a11y-basics",
      category: "accessibility",
      severity: "info",
      title: "Accessibility basics incomplete",
      detail: "Language attributes and descriptive image alts improve usability and indexing.",
    });
  }
  if (!signals.hasLocalSeoSignals) {
    findings.push({
      id: "local-seo-context",
      category: "seo",
      severity: "info",
      title: "Local SEO context appears weak",
      detail: "Service area and local relevance cues are limited on the audited page.",
    });
  }
  return findings;
}

export async function collectWebsiteSignals(url?: string): Promise<CollectedSignals> {
  const normalizedUrl = normalizeUrl(url);
  const fetchWarnings: string[] = [];
  let html = "";
  let statusCode: number | undefined;

  if (normalizedUrl) {
    const validation = await validateExternalUrl(normalizedUrl);
    if (!validation.ok) {
      fetchWarnings.push(`Website fetch skipped: ${validation.reason}`);
    } else {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const response = await fetch(validation.url, {
          signal: controller.signal,
          headers: { "user-agent": "PresenceLabsIntelligenceBot/1.0" },
        });
        clearTimeout(timeout);
        statusCode = response.status;
        html = (await response.text()).slice(0, 180_000);
      } catch (error) {
        fetchWarnings.push(`Could not fetch website: ${error instanceof Error ? error.message : "unknown"}`);
      }
    }
  }

  const signals = collectFindings({
    normalizedUrl,
    html,
    statusCode,
    fetchWarnings,
  });
  return {
    ...signals,
    findings: findingsFromSignals(signals),
  };
}
