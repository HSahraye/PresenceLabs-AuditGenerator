import { NextResponse } from "next/server";
import { z } from "zod";
import { applyPipelineAutomation } from "@/lib/automation/pipeline";
import { triggerWorkflows } from "@/lib/automation/workflows";
import { prisma } from "@/lib/prisma";
import { trackSalesOsEvent } from "@/lib/analytics/events";
import { trackEvent } from "@/lib/events";
import { enforceRateLimit, getClientRequestMeta } from "@/lib/request-security";
import { getWorkspaceContext } from "@/lib/workspace";

const schema = z.object({ leadId: z.string().min(1) });

export async function POST(request: Request) {
  const limited = await enforceRateLimit("payment-intent", 90, 60_000);
  if (limited) return limited;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const { userAgent, ip } = await getClientRequestMeta();
  const fallbackWorkspace = await getWorkspaceContext();
  const lead = await prisma.lead.findUnique({ where: { id: parsed.data.leadId }, select: { id: true, workspaceId: true } });
  if (!lead) return NextResponse.json({ ok: false }, { status: 404 });
  const workspaceId = lead.workspaceId ?? fallbackWorkspace.workspaceId;

  await prisma.paymentLog.create({
    data: {
      workspaceId,
      leadId: parsed.data.leadId,
      eventType: "clicked",
      provider: "manual-link",
      ip,
      userAgent,
    },
  });
  await prisma.lead.update({
    where: { id: parsed.data.leadId },
    data: { paymentStatus: "checkout_started" },
  });
  await trackEvent("payment_clicked", { leadId: parsed.data.leadId }, parsed.data.leadId, workspaceId);
  await trackSalesOsEvent({ eventType: "payment_intent_recorded", workspaceId, leadId: parsed.data.leadId });
  await applyPipelineAutomation({
    workspaceId,
    leadId: parsed.data.leadId,
    trigger: "payment_clicked",
  });
  await triggerWorkflows({
    workspaceId,
    leadId: parsed.data.leadId,
    eventType: "payment_intent_clicked",
    payload: {},
  });

  return NextResponse.json({ ok: true });
}
