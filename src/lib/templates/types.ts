import { z } from "zod";

export const TemplateToneSchema = z.enum(["authority", "consultative", "premium", "seo-focused", "ppc-focused", "direct-response"]);
export const TemplateCtaStyleSchema = z.enum(["direct", "soft", "consultative", "urgent"]);
export const TemplateUrgencyStyleSchema = z.enum(["calm", "balanced", "urgent"]);
export const TemplateOutreachStyleSchema = z.enum(["aggressive", "consultative", "roi", "local-trust", "premium"]);
export const TemplateProposalStyleSchema = z.enum(["value", "premium", "performance", "retainer"]);

export const BaseTemplateConfigSchema = z.object({
  tone: TemplateToneSchema.default("consultative"),
  ctaStyle: TemplateCtaStyleSchema.default("consultative"),
  sectionOrder: z.array(z.string()).default([]),
  emphasis: z.array(z.string()).default([]),
  packageLabels: z.record(z.string(), z.string()).default({}),
  guaranteeStyle: z.string().default("results-focused"),
  urgencyStyle: TemplateUrgencyStyleSchema.default("balanced"),
  outreachStyle: TemplateOutreachStyleSchema.default("consultative"),
  proposalStyle: TemplateProposalStyleSchema.default("value"),
});

export const AuditTemplateConfigSchema = BaseTemplateConfigSchema.extend({
  sectionOrder: z.array(z.string()).default([
    "executiveSummary",
    "revenueOpportunities",
    "trustIssues",
    "conversionBlockers",
    "seoOpportunities",
    "quickWins",
    "recommendedNextSteps",
  ]),
});

export const OutreachTemplateConfigSchema = BaseTemplateConfigSchema.extend({
  sectionOrder: z.array(z.string()).default(["coldOpen", "diagnosis", "outcome", "cta"]),
});

export const OfferTemplateConfigSchema = BaseTemplateConfigSchema.extend({
  sectionOrder: z.array(z.string()).default(["roi", "timeline", "deliverables", "guarantees", "onboarding", "socialProof"]),
});

export type BaseTemplateConfig = z.infer<typeof BaseTemplateConfigSchema>;
export type AuditTemplateConfig = z.infer<typeof AuditTemplateConfigSchema>;
export type OutreachTemplateConfig = z.infer<typeof OutreachTemplateConfigSchema>;
export type OfferTemplateConfig = z.infer<typeof OfferTemplateConfigSchema>;

export type TemplateKind = "audit" | "outreach" | "offer";

export type ResolvedTemplate<TConfig extends BaseTemplateConfig = BaseTemplateConfig> = {
  id: string;
  name: string;
  kind: TemplateKind;
  source: "category" | "default" | "system";
  category: string | null;
  version: number;
  config: TConfig;
};
