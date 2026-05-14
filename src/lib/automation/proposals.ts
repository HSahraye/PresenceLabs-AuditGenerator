import { OutboundMessageStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { enqueueOutboundMessage } from "@/lib/automation/outreach";
import { createActivity } from "@/lib/automation/timeline";

export async function sendProposal(input: {
  workspaceId: string;
  leadId: string;
  proposalUrl: string;
  subject?: string;
  body?: string;
  approvalRequired?: boolean;
}) {
  const message = await enqueueOutboundMessage({
    workspaceId: input.workspaceId,
    leadId: input.leadId,
    channel: "email",
    subject: input.subject || "Your proposal is ready",
    body:
      input.body ||
      `Your proposal is ready:\n${input.proposalUrl}\n\nReply to this email with any questions.`,
    status: input.approvalRequired === false ? "queued" : "pending_approval",
    metadata: { type: "proposal_delivery", proposalUrl: input.proposalUrl },
  });

  const delivery = await prisma.proposalDelivery.create({
    data: {
      workspaceId: input.workspaceId,
      leadId: input.leadId,
      outboundMessageId: message.id,
      status: message.status,
      proposalUrl: input.proposalUrl,
      sentAt: message.status === OutboundMessageStatus.sent ? new Date() : null,
      metadataJson: JSON.stringify({ viaMessageId: message.id }),
    },
  });

  await createActivity({
    workspaceId: input.workspaceId,
    leadId: input.leadId,
    type: "proposal.delivery.created",
    detail: input.proposalUrl,
    source: "automation",
    metadata: { proposalDeliveryId: delivery.id },
  });

  return delivery;
}

export async function markProposalOpened(input: {
  workspaceId: string;
  leadId: string;
  proposalDeliveryId: string;
}) {
  await prisma.proposalDelivery.updateMany({
    where: { id: input.proposalDeliveryId, workspaceId: input.workspaceId, leadId: input.leadId },
    data: { openedAt: new Date() },
  });
  await prisma.activity.create({
    data: {
      workspaceId: input.workspaceId,
      leadId: input.leadId,
      type: "proposal.opened",
      source: "tracking",
    },
  });
}

export async function enqueueProposalReminder(input: {
  workspaceId: string;
  leadId: string;
  proposalDeliveryId: string;
  delayHours?: number;
}) {
  const delivery = await prisma.proposalDelivery.findFirst({
    where: { id: input.proposalDeliveryId, workspaceId: input.workspaceId, leadId: input.leadId },
  });
  if (!delivery || !delivery.proposalUrl) return null;
  return enqueueOutboundMessage({
    workspaceId: input.workspaceId,
    leadId: input.leadId,
    channel: "email",
    subject: "Quick reminder on your proposal",
    body: `Friendly reminder to review your proposal:\n${delivery.proposalUrl}`,
    status: "pending_approval",
    scheduledAt: new Date(Date.now() + (input.delayHours ?? 24) * 60 * 60 * 1000),
    metadata: { type: "proposal_reminder", proposalDeliveryId: delivery.id },
  });
}
