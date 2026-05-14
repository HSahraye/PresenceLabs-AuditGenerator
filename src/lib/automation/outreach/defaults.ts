export type SequenceStepChannel = "email" | "sms" | "task" | "call";

export function defaultStepName(channel: SequenceStepChannel, index: number) {
  if (channel === "email") return `Step ${index + 1}: Email intro`;
  if (channel === "sms") return `Step ${index + 1}: SMS follow-up`;
  if (channel === "call") return `Step ${index + 1}: Call {{businessName}}`;
  return `Step ${index + 1}: Task`;
}

export function defaultStepSubject(channel: SequenceStepChannel) {
  if (channel === "email") return "Quick idea for {{businessName}}";
  return "";
}

export function defaultStepContent(channel: SequenceStepChannel) {
  if (channel === "email") {
    return `Hi {{ownerName}},

I took a quick look at {{businessName}} and noticed a few areas where your online presence could be tightened up, especially around {{painPoint}}.

I put together a quick audit showing what I'd fix first and how it could help bring in more local customers.

Worth taking a look?`;
  }
  if (channel === "sms") {
    return "Hi {{ownerName}}, I reviewed {{businessName}} and noticed a few quick wins around {{painPoint}}. I can send over a short audit if you want to see it.";
  }
  if (channel === "call" || channel === "task") {
    return "Review the audit, mention {{painPoint}}, and position {{recommendedOffer}} as the next best step.";
  }
  return "";
}
