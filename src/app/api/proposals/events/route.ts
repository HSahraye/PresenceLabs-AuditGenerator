import { NextResponse } from "next/server";
import { z } from "zod";
import { applyPipelineAutomation } from "@/lib/automation/pipeline";
import { prisma } from "@/lib/prisma";
import { triggerWorkflows } from "@/lib/automation/workflows";

const schema = z.object({
  workspaceId: z.string().min(1),
  leadId: z.string().min(1),
  proposalDeliveryId: z.string().optional(),
  eventType: z.enum(["opened", "reopened", "accepted"]),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid payload." }, { status: 400 });

  if (parsed.data.proposalDeliveryId) {
    await prisma.proposalDelivery.updateMany({
      where: {
        id: parsed.data.proposalDeliveryId,
        workspaceId: parsed.data.workspaceId,
        leadId: parsed.data.leadId,
      },
      data: {
        openedAt: parsed.data.eventType === "opened" || parsed.data.eventType === "reopened" ? new Date() : undefined,
        acceptedAt: parsed.data.eventType === "accepted" ? new Date() : undefined,
      },
    });
  }

  await prisma.activity.create({
    data: {
      workspaceId: parsed.data.workspaceId,
      leadId: parsed.data.leadId,
      type: `proposal.${parsed.data.eventType}`,
      source: "tracking",
    },
  });

  await triggerWorkflows({
    workspaceId: parsed.data.workspaceId,
    leadId: parsed.data.leadId,
    eventType: `proposal_${parsed.data.eventType}`,
    payload: {},
  });
  if (parsed.data.eventType === "opened" || parsed.data.eventType === "reopened") {
    await applyPipelineAutomation({
      workspaceId: parsed.data.workspaceId,
      leadId: parsed.data.leadId,
      trigger: "proposal_viewed",
    });
  }

  return NextResponse.json({ ok: true });
}
