import { OutboundMessageStatus, SequenceChannel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/communication/email";
import { sendSms } from "@/lib/communication/sms";
import { ensureWorkspaceOperational } from "@/lib/billing/entitlements";
import { createTask } from "@/lib/automation/tasks";
import { createActivity } from "@/lib/automation/timeline";
import { trackEvent } from "@/lib/events";
import { buildPublicUrl } from "@/lib/url";

export async function enqueueOutboundMessage(input: {
  workspaceId: string;
  leadId?: string;
  sequenceStateId?: string;
  channel: SequenceChannel;
  subject?: string;
  body: string;
  status?: OutboundMessageStatus;
  scheduledAt?: Date;
  metadata?: Record<string, unknown>;
}) {
  return prisma.outboundMessage.create({
    data: {
      workspaceId: input.workspaceId,
      leadId: input.leadId ?? null,
      sequenceStateId: input.sequenceStateId ?? null,
      channel: input.channel,
      subject: input.subject ?? null,
      body: input.body,
      status: input.status ?? "pending_approval",
      scheduledAt: input.scheduledAt ?? new Date(),
      nextAttemptAt: input.scheduledAt ?? new Date(),
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });
}

async function sendMessage(message: {
  id: string;
  workspaceId: string;
  leadId: string | null;
  channel: SequenceChannel;
  subject: string | null;
  body: string;
  retryCount: number;
}) {
  const hour = new Date().getHours();
  if (hour >= 21 || hour < 8) {
    return { ok: false as const, error: "Quiet-hours enforcement active." };
  }
  const lead = message.leadId
    ? await prisma.lead.findUnique({
        where: { id: message.leadId },
        select: { id: true, email: true, phone: true },
      })
    : null;

  if (message.channel === "email") {
    if (!lead?.email) return { ok: false as const, error: "Lead email missing." };
    const unsubscribed = await prisma.unsubscribedContact.findUnique({
      where: {
        workspaceId_email: {
          workspaceId: message.workspaceId,
          email: lead.email,
        },
      },
      select: { id: true },
    });
    if (unsubscribed) return { ok: false as const, error: "Contact unsubscribed from email." };
    const unsubscribeUrl = `${buildPublicUrl("/api/communication/unsubscribe")}?workspaceId=${encodeURIComponent(message.workspaceId)}&email=${encodeURIComponent(lead.email)}`;
    return sendEmail({
      workspaceId: message.workspaceId,
      to: lead.email,
      subject: message.subject || "Quick follow-up",
      html: message.body.replace(/\n/g, "<br/>"),
      text: message.body,
      unsubscribeUrl,
    });
  }
  if (message.channel === "sms") {
    if (!lead?.phone) return { ok: false as const, error: "Lead phone missing." };
    const unsubscribed = await prisma.unsubscribedContact.findUnique({
      where: {
        workspaceId_phone: {
          workspaceId: message.workspaceId,
          phone: lead.phone,
        },
      },
      select: { id: true },
    });
    if (unsubscribed) return { ok: false as const, error: "Contact unsubscribed from SMS." };
    return sendSms({
      workspaceId: message.workspaceId,
      to: lead.phone,
      body: message.body,
    });
  }
  if (message.channel === "task" || message.channel === "call") {
    await createTask({
      workspaceId: message.workspaceId,
      leadId: message.leadId ?? undefined,
      title: message.channel === "call" ? "Call lead" : "Follow-up task",
      description: message.body,
      source: "automation",
      dueAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    return { ok: true, provider: "internal-task", providerMessageId: `task-${Date.now()}` };
  }
  return { ok: false, provider: "unknown", error: "Unsupported channel." };
}

export async function processOutboundQueue(options?: { limit?: number }) {
  const now = new Date();
  const limit = Math.max(1, Math.min(options?.limit ?? 20, 100));
  const messages = await prisma.outboundMessage.findMany({
    where: {
      status: { in: ["queued", "approved"] },
      AND: [
        { OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }] },
        { OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  for (const message of messages) {
    const workspaceState = await ensureWorkspaceOperational(message.workspaceId);
    if (!workspaceState.ok) {
      await prisma.outboundMessage.update({
        where: { id: message.id },
        data: {
          status: "failed",
          lastError: workspaceState.reason,
        },
      });
      await createActivity({
        workspaceId: message.workspaceId,
        leadId: message.leadId ?? undefined,
        type: "automation.message.failed",
        detail: workspaceState.reason,
        source: "automation",
        metadata: { messageId: message.id },
      });
      continue;
    }

    const result = await sendMessage({
      id: message.id,
      workspaceId: message.workspaceId,
      leadId: message.leadId,
      channel: message.channel,
      subject: message.subject,
      body: message.body,
      retryCount: message.retryCount,
    });

    if (result.ok) {
      await prisma.outboundMessage.update({
        where: { id: message.id },
        data: {
          status: "sent",
          sentAt: new Date(),
          provider: result.provider,
          providerMessageId: result.providerMessageId ?? null,
          lastError: null,
        },
      });
      await createActivity({
        workspaceId: message.workspaceId,
        leadId: message.leadId ?? undefined,
        type: `automation.${message.channel}.sent`,
        detail: message.subject || message.body.slice(0, 140),
        source: "automation",
      });
      await trackEvent(
        "automation_message_sent",
        { messageId: message.id, channel: message.channel, provider: result.provider },
        message.leadId ?? undefined,
        message.workspaceId,
      );
    } else {
      const nextRetryInMinutes = Math.min(120, 5 * (message.retryCount + 1));
      const terminalFailure = message.retryCount >= 4;
      await prisma.outboundMessage.update({
        where: { id: message.id },
        data: {
          retryCount: { increment: 1 },
          status: terminalFailure ? "failed" : "queued",
          lastError: result.error || "Send failed",
          nextAttemptAt: terminalFailure ? null : new Date(Date.now() + nextRetryInMinutes * 60 * 1000),
        },
      });
      await createActivity({
        workspaceId: message.workspaceId,
        leadId: message.leadId ?? undefined,
        type: terminalFailure ? "automation.message.failed" : "automation.retry.scheduled",
        detail: result.error || "Send failed",
        source: "automation",
        metadata: {
          messageId: message.id,
          retryCount: message.retryCount + 1,
          nextRetryInMinutes: terminalFailure ? null : nextRetryInMinutes,
        },
      });
    }
  }
}
