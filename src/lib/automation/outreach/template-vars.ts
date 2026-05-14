const TEMPLATE_VARS = ["businessName", "ownerName", "city", "category", "painPoint", "recommendedOffer"] as const;

export type SequenceTemplateContext = {
  businessName: string;
  ownerName?: string | null;
  city?: string | null;
  category?: string | null;
  painPoint?: string | null;
  recommendedOffer?: string | null;
};

export const SUPPORTED_TEMPLATE_VARIABLES = TEMPLATE_VARS.map((name) => `{{${name}}}`);

function resolveValue(context: SequenceTemplateContext, variable: (typeof TEMPLATE_VARS)[number]) {
  const fallback: Record<(typeof TEMPLATE_VARS)[number], string> = {
    businessName: context.businessName || "this business",
    ownerName: context.ownerName || "there",
    city: context.city || "your area",
    category: context.category || "local business",
    painPoint: context.painPoint || "conversion friction",
    recommendedOffer: context.recommendedOffer || "growth package",
  };
  return fallback[variable];
}

export function validateTemplateVariables(template: string) {
  const matches = template.match(/{{\s*[^}]+\s*}}/g) ?? [];
  const unknown: string[] = [];
  for (const raw of matches) {
    const normalized = raw.replace(/[{}]/g, "").trim();
    if (!TEMPLATE_VARS.includes(normalized as (typeof TEMPLATE_VARS)[number])) {
      unknown.push(raw);
    }
  }
  return {
    valid: unknown.length === 0,
    unknownVariables: unknown,
  };
}

export function renderSequenceTemplate(template: string | null | undefined, context: SequenceTemplateContext) {
  const source = template || "Hi {{ownerName}}, quick follow-up for {{businessName}}.";
  return source.replace(/{{\s*([^}]+)\s*}}/g, (_match, variable) => {
    const key = String(variable).trim();
    if (!TEMPLATE_VARS.includes(key as (typeof TEMPLATE_VARS)[number])) return "";
    return resolveValue(context, key as (typeof TEMPLATE_VARS)[number]);
  });
}
