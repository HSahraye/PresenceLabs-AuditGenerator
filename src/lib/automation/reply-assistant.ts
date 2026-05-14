import { generateStructuredResponse } from "@/lib/ai/provider";
import { getLeadTimeline } from "@/lib/automation/timeline";

export async function draftReplyAssistant(input: {
  workspaceId: string;
  leadId: string;
  incomingMessage: string;
  objective?: string;
}) {
  const timeline = await getLeadTimeline(input.workspaceId, input.leadId);
  const recent = timeline.slice(0, 10).map((item) => ({
    type: item.type,
    detail: item.detail,
    source: item.source,
    createdAt: item.createdAt.toISOString(),
  }));
  const response = await generateStructuredResponse<{
    summary: string;
    draftReply: string;
    objectionHandling: string;
    urgencyFraming: string;
  }>({
    task: "Draft a concise agency follow-up reply with objection handling.",
    outputContract: "{summary:string,draftReply:string,objectionHandling:string,urgencyFraming:string}",
    input: {
      incomingMessage: input.incomingMessage,
      objective: input.objective || "move lead toward next step",
      recentTimeline: recent,
    },
    metadata: {
      workspaceId: input.workspaceId,
      generationType: "reply_assistant",
    },
  });
  if (!response) {
    return {
      summary: "Could not generate AI summary.",
      draftReply: "Thanks for the update. Happy to answer any questions and walk through next steps.",
      objectionHandling: "Acknowledge concern, restate value, ask one clear next-step question.",
      urgencyFraming: "Keep momentum this week while intent is active.",
    };
  }
  return response;
}
