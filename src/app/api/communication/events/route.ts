import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { triggerWorkflows } from "@/lib/automation/workflows";

const schema = z.object({
  workspaceId: z.string().min(1),
  leadId: z.string().optional(),
  outboundMessageId: z.string().optional(),
  eventType: z.string().min(1),
  provider: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid communication event payload." }, { status: 400 });
  const event = await prisma.communicationEvent.create({
    data: {
      workspaceId: parsed.data.workspaceId,
      leadId: parsed.data.leadId ?? null,
      outboundMessageId: parsed.data.outboundMessageId ?? null,
      eventType: parsed.data.eventType,
      provider: parsed.data.provider ?? null,
      metadataJson: parsed.data.metadata ? JSON.stringify(parsed.data.metadata) : null,
    },
  });

  if (parsed.data.outboundMessageId && (parsed.data.eventType === "open" || parsed.data.eventType === "click" || parsed.data.eventType === "delivery")) {
    await prisma.outboundMessage.updateMany({
      where: {
        id: parsed.data.outboundMessageId,
        workspaceId: parsed.data.workspaceId,
      },
      data: {
        status: "sent",
      },
    });
  }

  if (parsed.data.eventType === "unsubscribe" || parsed.data.eventType === "bounce") {
    const email = typeof parsed.data.metadata?.email === "string" ? parsed.data.metadata.email.toLowerCase() : null;
    const phone = typeof parsed.data.metadata?.phone === "string" ? parsed.data.metadata.phone : null;
    if (email) {
      await prisma.unsubscribedContact.upsert({
        where: {
          workspaceId_email: {
            workspaceId: parsed.data.workspaceId,
            email,
          },
        },
        update: { reason: parsed.data.eventType },
        create: {
          workspaceId: parsed.data.workspaceId,
          email,
          reason: parsed.data.eventType,
        },
      });
    } else if (phone) {
      await prisma.unsubscribedContact.upsert({
        where: {
          workspaceId_phone: {
            workspaceId: parsed.data.workspaceId,
            phone,
          },
        },
        update: { reason: parsed.data.eventType },
        create: {
          workspaceId: parsed.data.workspaceId,
          phone,
          reason: parsed.data.eventType,
        },
      });
    }
  }

  await triggerWorkflows({
    workspaceId: parsed.data.workspaceId,
    leadId: parsed.data.leadId,
    eventType: `communication.${parsed.data.eventType}`,
    payload: parsed.data.metadata ?? {},
  });

  return NextResponse.json({ ok: true, eventId: event.id });
}
