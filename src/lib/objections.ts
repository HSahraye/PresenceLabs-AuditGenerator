import type { GeneratedAssets } from "@/lib/types";

export type ObjectionResponse = {
  objection: string;
  response: string;
  followUp: string;
};

export function generateObjectionResponses(
  businessName: string,
  assets: GeneratedAssets,
  packageName: string,
): ObjectionResponse[] {
  const pitch = assets.thirtySecondPitch || `helping ${businessName} get more calls from local search`;
  const loss = assets.likelyMoneyLost || "missed calls and lost revenue from customers who can't find or trust you online";
  const offer = assets.presenceLabsOffer || `the ${packageName}`;

  return [
    {
      objection: "It's too expensive / I don't have budget right now.",
      response: `Totally understand — and I want to make sure this is the right move for you before you spend anything. The audit shows ${businessName} is likely missing customers right now because of gaps in your online presence. ${loss} That's money leaving every month. ${offer} The goal is to pay for itself in recovered leads within the first month or two.`,
      followUp: "What would make this feel like a no-brainer investment for you?",
    },
    {
      objection: "I already have a website / someone handling my marketing.",
      response: `That's great — and this isn't about replacing what you have. The audit actually found specific gaps that are costing you conversions: customers landing on your site or profile and not calling. Even a solid website can leak leads if the mobile experience, trust signals, or CTAs aren't dialed in. ${pitch} We're talking about fixing the last 20% that drives 80% of the calls.`,
      followUp: "Would it be okay if I showed you the 3 specific things we found that are likely losing you calls right now?",
    },
    {
      objection: "I need to think about it / let me call you back.",
      response: `Of course — I respect that. I just want to make sure you have everything you need to make the call. I'll send over the full audit report right now so you can review the findings on your own time. It shows exactly what's happening with ${businessName}'s online presence and what we'd fix. No pressure.`,
      followUp: "Is there a specific concern I can address before we wrap up today?",
    },
    {
      objection: "I'm not interested.",
      response: `Completely fair. Out of curiosity — is it the timing, the cost, or you're just not focused on online presence right now? I ask because the audit shows a few things that could be bleeding leads silently, and I'd hate for you to miss that just because the timing wasn't right on my end.`,
      followUp: "If there was one thing about your online presence you'd want to fix this year, what would it be?",
    },
    {
      objection: "I need to talk to my partner / spouse / business partner first.",
      response: `Absolutely — this is a business decision and it makes sense to loop them in. Let me send you the audit report so you have something concrete to share. It lays out the specific gaps, what we fix, and the investment clearly. That way the conversation with your partner is based on the actual data, not just a sales call.`,
      followUp: `When's a good time to reconnect once you've had that conversation? I can also jump on a quick call with both of you if that's easier.`,
    },
  ];
}
