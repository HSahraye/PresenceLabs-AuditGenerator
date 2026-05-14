import type { AuditInput } from "@/lib/types";

export type FindingSeverity = "info" | "warning" | "critical";
export type FindingCategory =
  | "technical"
  | "seo"
  | "conversion"
  | "trust"
  | "accessibility"
  | "branding";

export type Finding = {
  id: string;
  category: FindingCategory;
  severity: FindingSeverity;
  title: string;
  detail: string;
  evidence?: string;
};

export type CollectedSignals = {
  normalizedUrl: string;
  html: string;
  statusCode?: number;
  fetchWarnings: string[];
  hasHttps: boolean;
  hasTitle: boolean;
  title: string;
  hasMetaDescription: boolean;
  metaDescription: string;
  hasViewportMeta: boolean;
  hasSchemaMarkup: boolean;
  hasBrokenAnchorTargets: boolean;
  hasSocialLinks: boolean;
  hasReviewSignals: boolean;
  hasTrustBadges: boolean;
  hasContactInfo: boolean;
  hasPhonePattern: boolean;
  hasEmailPattern: boolean;
  hasCta: boolean;
  hasBookingLanguage: boolean;
  hasServiceLanguage: boolean;
  hasPricingLanguage: boolean;
  hasFaqLanguage: boolean;
  hasGalleryLanguage: boolean;
  hasLocalSeoSignals: boolean;
  hasAccessibilityLangAttr: boolean;
  hasImageAltTextHints: boolean;
  bodySize: number;
  performanceHint: "good" | "moderate" | "poor";
  findings: Finding[];
};

export type LeadIntelligence = {
  scores: {
    seo: number;
    performance: number;
    trust: number;
    conversion: number;
    accessibility: number;
    branding: number;
  };
  painPoints: string[];
  strengths: string[];
  urgencyScore: number;
  momentumScore?: number;
  likelyBudget: "low" | "medium" | "high";
  recommendedOffer: string;
  outreachAngles: string[];
  objections: string[];
  closeProbability: number;
  findings: {
    technical: Finding[];
    seo: Finding[];
    conversion: Finding[];
    trust: Finding[];
  };
  generatedAt: string;
};

export type LeadIntelligenceInput = AuditInput & {
  engagementSignals?: {
    viewCount?: number;
    paymentClickCount?: number;
    lastViewedAt?: string | null;
  };
  narrativeContext?: {
    brandName?: string | null;
    tone?: string | null;
    outreachStyle?: string | null;
    proposalStyle?: string | null;
    urgencyStyle?: string | null;
    emphasis?: string[];
    ctaStyle?: string | null;
  };
  weighting?: Partial<Record<keyof LeadIntelligence["scores"], number>>;
};
