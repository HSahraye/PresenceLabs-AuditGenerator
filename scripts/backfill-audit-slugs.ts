import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const MAX_SLUG_LENGTH = 32;

function normalizeAuditSlug(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, MAX_SLUG_LENGTH);
}

async function generateUniqueAuditSlug(businessName: string, excludeLeadId?: string) {
  const base = normalizeAuditSlug(businessName) || "audit";

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

async function run() {
  const leads = await prisma.lead.findMany({
    where: { shortSlug: null },
    select: { id: true, businessName: true },
    orderBy: { createdAt: "asc" },
  });

  let updated = 0;
  for (const lead of leads) {
    const shortSlug = await generateUniqueAuditSlug(lead.businessName, lead.id);
    await prisma.lead.update({
      where: { id: lead.id },
      data: { shortSlug },
    });
    updated += 1;
  }

  console.log(`Backfilled short slugs for ${updated} leads.`);
}

run()
  .catch((error) => {
    console.error("Failed to backfill audit slugs.", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
