import { prisma } from "@/lib/prisma";

export async function applyPipelineAutomation(input: {
  workspaceId: string;
  leadId: string;
  trigger: "proposal_viewed" | "payment_clicked" | "no_engagement" | "repeated_opens";
}) {
  if (input.trigger === "proposal_viewed") {
    await prisma.lead.updateMany({
      where: { id: input.leadId, workspaceId: input.workspaceId },
      data: { status: "Follow-up" },
    });
    return;
  }

  if (input.trigger === "payment_clicked") {
    await prisma.lead.updateMany({
      where: { id: input.leadId, workspaceId: input.workspaceId },
      data: { status: "Follow-up", paymentStatus: "checkout_started" },
    });
    return;
  }

  if (input.trigger === "no_engagement") {
    await prisma.lead.updateMany({
      where: { id: input.leadId, workspaceId: input.workspaceId },
      data: { status: "Follow-up" },
    });
    return;
  }

  if (input.trigger === "repeated_opens") {
    await prisma.lead.updateMany({
      where: { id: input.leadId, workspaceId: input.workspaceId },
      data: { status: "Contacted" },
    });
  }
}
