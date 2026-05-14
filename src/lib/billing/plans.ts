import type { PlanTier } from "@prisma/client";

export type PlanLimits = {
  auditsPerMonth: number;
  importsPerMonth: number;
  activeLeads: number;
  templates: number;
  seats: number;
  outreachGenerations: number;
  proposalGenerations: number;
};

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free_trial: {
    auditsPerMonth: 40,
    importsPerMonth: 300,
    activeLeads: 500,
    templates: 8,
    seats: 2,
    outreachGenerations: 120,
    proposalGenerations: 60,
  },
  starter: {
    auditsPerMonth: 120,
    importsPerMonth: 1200,
    activeLeads: 2500,
    templates: 25,
    seats: 5,
    outreachGenerations: 600,
    proposalGenerations: 240,
  },
  growth: {
    auditsPerMonth: 400,
    importsPerMonth: 4500,
    activeLeads: 10000,
    templates: 80,
    seats: 15,
    outreachGenerations: 2500,
    proposalGenerations: 800,
  },
  agency: {
    auditsPerMonth: 1200,
    importsPerMonth: 14000,
    activeLeads: 35000,
    templates: 200,
    seats: 40,
    outreachGenerations: 9000,
    proposalGenerations: 3000,
  },
  enterprise: {
    auditsPerMonth: 1000000,
    importsPerMonth: 1000000,
    activeLeads: 1000000,
    templates: 10000,
    seats: 10000,
    outreachGenerations: 1000000,
    proposalGenerations: 1000000,
  },
};

export const PLAN_DISPLAY: Record<PlanTier, { label: string; monthlyPriceCents: number }> = {
  free_trial: { label: "Free Trial", monthlyPriceCents: 0 },
  starter: { label: "Starter", monthlyPriceCents: 4900 },
  growth: { label: "Growth", monthlyPriceCents: 14900 },
  agency: { label: "Agency", monthlyPriceCents: 39900 },
  enterprise: { label: "Enterprise", monthlyPriceCents: 0 },
};
