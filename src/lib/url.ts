import { buildPreferredAuditPath } from "@/lib/audit-links";

function normalizeBaseUrl(value: string) {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed.replace(/\/+$/, "");
  return `https://${trimmed.replace(/\/+$/, "")}`;
}

export function getPublicBaseUrl() {
  const explicit = normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "");
  if (explicit) return explicit;
  const vercel = normalizeBaseUrl(process.env.VERCEL_URL || "");
  if (vercel) return vercel;
  return "http://localhost:3000";
}

export function buildPublicUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getPublicBaseUrl()}${normalizedPath}`;
}

export function buildShortAuditUrl(lead: { id: string; shortSlug?: string | null }) {
  return buildPublicUrl(buildPreferredAuditPath({ leadId: lead.id, shortSlug: lead.shortSlug }));
}
