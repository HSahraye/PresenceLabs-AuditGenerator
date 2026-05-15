import { notFound, redirect } from "next/navigation";
import { createAuditAccessToken } from "@/lib/audit-links";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ShortAuditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const lead = await prisma.lead.findUnique({
    where: { shortSlug: String(slug || "").toLowerCase() },
    select: { id: true, shortSlug: true },
  });

  if (!lead) notFound();

  const token = createAuditAccessToken(lead.id);
  redirect(`/audit/${lead.id}?token=${encodeURIComponent(token)}`);
}
