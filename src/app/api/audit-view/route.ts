import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { trackEvent } from "@/lib/events";
import { enforceRateLimit, getClientRequestMeta } from "@/lib/request-security";

const schema = z.object({ leadId: z.string().min(1) });

export async function POST(request: Request) {
  const limited = await enforceRateLimit("audit-view", 90, 60_000);
  if (limited) return limited;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const { userAgent, ip } = await getClientRequestMeta();

  await prisma.viewLog.create({
    data: {
      leadId: parsed.data.leadId,
      ip,
      userAgent,
    },
  });
  await trackEvent("audit_viewed", { leadId: parsed.data.leadId, ip: ip ?? "unknown" }, parsed.data.leadId);

  return NextResponse.json({ ok: true });
}
