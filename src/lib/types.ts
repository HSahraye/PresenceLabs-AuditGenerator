export type AuditInput = {
  businessName: string;
  ownerName?: string;
  category?: string;
  location?: string;
  websiteUrl?: string;
  googleProfileUrl?: string;
  notes?: string;
};

export type AuditChecks = {
  hasWebsite: boolean;
  outdatedWebsite: boolean;
  mobileFriendly: boolean;
  clearCta: boolean;
  phoneEasyToFind: boolean;
  reviewsVisible: boolean;
  onlineBooking: boolean;
  trustSection: boolean;
  gallery: boolean;
  serviceList: boolean;
  pricing: boolean;
  faq: boolean;
};

export type GeneratedAssets = {
  leadScore: number;
  painPointSummary: string;
  recommendedPackage: string;
  likelyMoneyLost: string;
  presenceLabsOffer: string;
  estimatedAnnualLoss?: number;
  coldCallScript: string;
  textMessageScript: string;
  emailScript: string;
  thirtySecondPitch: string;
  followUpMessage: string;
  proposalOutline: string[];
};

export type AuditResult = {
  checks: AuditChecks;
  assets: GeneratedAssets;
  websiteSignals: string[];
  warnings: string[];
  source: "claude" | "gemini" | "local-fallback";
};
