import { NextResponse } from "next/server";
import { z } from "zod";
import { triggerWorkflows } from "@/lib/automation/workflows";
import { applyPipelineAutomation } from "@/lib/automation/pipeline";
import { prisma } from "@/lib/prisma";
import { trackSalesOsEvent } from "@/lib/analytics/events";
import { trackEvent } from "@/lib/events";
import { enforceRateLimit, getClientRequestMeta } from "@/lib/request-security";
import { getWorkspaceContext } from "@/lib/workspace";

const schema = z.object({ leadId: z.string().min(1) });

export async function POST(request: Request) {
  const limited = await enforceRateLimit("audit-view", 90, 60_000);
  if (limited) return limited;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const { userAgent, ip } = await getClientRequestMeta();
  const fallbackWorkspace = await getWorkspaceContext();
  const lead = await prisma.lead.findUnique({ where: { id: parsed.data.leadId }, select: { id: true, workspaceId: true } });
  if (!lead) return NextResponse.json({ ok: false }, { status: 404 });
  const workspaceId = lead.workspaceId ?? fallbackWorkspace.workspaceId;

  await prisma.viewLog.create({
    data: {
      workspaceId,
      leadId: parsed.data.leadId,
      ip,
      userAgent,
    },
  });
  await trackEvent("audit_viewed", { leadId: parsed.data.leadId, ip: ip ?? "unknown" }, parsed.data.leadId, workspaceId);
  const recentViews = await prisma.viewLog.count({
    where: {
      leadId: parsed.data.leadId,
      ...(workspaceId ? { workspaceId } : {}),
      createdAt: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) },
    },
  });
  if (recentViews >= 3) {
    await trackSalesOsEvent({
      eventType: "engagement_spike_detected",
      workspaceId,
      leadId: parsed.data.leadId,
      payload: { recentViews },
    });
    await applyPipelineAutomation({
      workspaceId,
      leadId: parsed.data.leadId,
      trigger: "repeated_opens",
    });
  }
  await triggerWorkflows({
    workspaceId,
    leadId: parsed.data.leadId,
    eventType: "audit_viewed",
    payload: { recentViews },
  });

  return NextResponse.json({ ok: true });
}
