import { prisma } from "@/lib/prisma";

const MAX_SLUG_LENGTH = 32;

export function normalizeAuditSlug(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, MAX_SLUG_LENGTH);
}

export function createAuditSlugBase(businessName: string) {
  const normalized = normalizeAuditSlug(businessName || "");
  return normalized || "audit";
}

export async function generateUniqueAuditSlug(
  businessName: string,
  options?: { excludeLeadId?: string },
) {
  const base = createAuditSlugBase(businessName);
  const excludeLeadId = options?.excludeLeadId;

  const isAvailable = async (candidate: string) => {
    const existing = await prisma.lead.findFirst({
      where: {
        shortSlug: candidate,
        ...(excludeLeadId ? { id: { not: excludeLeadId } } : {}),
      },
      select: { id: true },
    });
    return !existing;
  };

  if (await isAvailable(base)) return base;

  for (let i = 2; i <= 25; i += 1) {
    const candidate = `${base}-${i}`.slice(0, MAX_SLUG_LENGTH);
    if (await isAvailable(candidate)) return candidate;
  }

  for (let i = 0; i < 25; i += 1) {
    const suffix = Math.random().toString(36).slice(2, 5);
    const baseMax = Math.max(1, MAX_SLUG_LENGTH - suffix.length - 1);
    const candidate = `${base.slice(0, baseMax)}-${suffix}`;
    if (await isAvailable(candidate)) return candidate;
  }

  throw new Error("Could not generate a unique short audit slug.");
}
