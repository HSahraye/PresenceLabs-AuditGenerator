import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import type { AuditChecks, AuditInput, AuditResult, GeneratedAssets } from "./types";
import { validateExternalUrl } from "./network-safety";

const inputSchema = z.object({
  businessName: z.string().min(1).max(140),
  category: z.string().max(80).optional().or(z.literal("")),
  location: z.string().max(120).optional().or(z.literal("")),
  websiteUrl: z.string().max(300).optional().or(z.literal("")),
  googleProfileUrl: z.string().max(500).optional().or(z.literal("")),
  notes: z.string().max(4000).optional().or(z.literal("")),
});

const businessCategoryDefaults: Record<string, string> = {
  contractor: "Home service businesses lose high-intent quote requests when visitors cannot quickly trust the work, see proof, and call from mobile.",
  mechanic: "Auto customers compare trust, reviews, and speed. A weak site loses repair calls to cleaner competitors with booking and service pages.",
  cleaner: "Cleaning leads often convert from mobile. Missing proof, pricing guidance, and booking makes the business look smaller than it is.",
  barber: "Barber prospects want photos, reviews, pricing, and booking. If those are missing, they choose a shop with instant confidence.",
  landscaper: "Landscaping customers need visual proof and fast quote CTAs. Missing galleries and service areas reduce estimate requests.",
  detailer: "Mobile detailing buyers need packages, before/after photos, and booking. Weak pages leak premium jobs.",
  restaurant: "Restaurant visitors expect menu, hours, reviews, photos, directions, and ordering/reservations. Missing basics loses immediate visits.",
  plumber: "Plumbing calls are urgent. If a customer can't find a phone number in under 5 seconds, they call the next result.",
  electrician: "Electrical leads need trust signals fast — license info, reviews, and a clear call button are table stakes.",
  roofer: "Roofing is high-ticket and high-trust. Weak proof, no gallery, and poor mobile experience send quotes to competitors.",
  dentist: "Dental practices lose new patients to competitors with visible reviews, easy booking, and service pages that answer common questions.",
  salon: "Beauty clients choose based on photos, reviews, and pricing. Missing any of these sends them to the next Instagram-friendly competitor.",
  gym: "Fitness businesses convert on class schedules, pricing, and free trial CTAs. A static page with no clear action leaks memberships.",
  realestate: "Real estate leads expect listings, agent bios, and instant contact. Generic sites lose trust in the first 8 seconds.",
  lawyer: "Legal clients need trust signals immediately: bar number, practice areas, testimonials, and a free consultation CTA.",
  accountant: "Accounting prospects compare credibility. A thin web presence with no service list or proof loses them before the first call.",
  hvac: "HVAC calls spike seasonally and urgently. A weak mobile presence and no booking option loses jobs to competitors on the same Google page.",
};

function normalizeUrl(url?: string) {
  if (!url?.trim()) return "";
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

async function fetchWebsiteSignals(url?: string) {
  const normalized = normalizeUrl(url);
  const warnings: string[] = [];
  const signals: string[] = [];
  let html = "";

  if (!normalized) return { html, signals: ["No website URL provided."], warnings };
  const validation = await validateExternalUrl(normalized);
  if (!validation.ok) {
    warnings.push(`Website fetch skipped: ${validation.reason}`);
    signals.push("Website could not be inspected automatically.");
    return { html, signals, warnings };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(validation.url, {
      signal: controller.signal,
      headers: { "user-agent": "PresenceLabsAuditBot/1.0" },
    });
    clearTimeout(timeout);

    signals.push(`Website responded with HTTP ${response.status}.`);
    html = (await response.text()).slice(0, 150_000);

    const lower = html.toLowerCase();
    if (/<meta[^>]+name=["']viewport["']/i.test(html)) signals.push("Viewport meta tag found.");
    if (/tel:|\(\d{3}\)\s?\d{3}-\d{4}|\d{3}[-.\s]\d{3}[-.\s]\d{4}/.test(html)) signals.push("Phone number or click-to-call pattern found.");
    if (/book|schedule|appointment|quote|estimate|call now|contact us/.test(lower)) signals.push("CTA language found.");
    if (/review|testimonial|stars|yelp|google/.test(lower)) signals.push("Review/testimonial language found.");
    if (/gallery|portfolio|before|after|photos|projects/.test(lower)) signals.push("Gallery/proof language found.");
    if (/faq|frequently asked/.test(lower)) signals.push("FAQ language found.");
    if (/price|pricing|packages|rates/.test(lower)) signals.push("Pricing/package language found.");
    if (/service|services|what we do/.test(lower)) signals.push("Service-list language found.");
    if (html.length < 2500) warnings.push("Website HTML is very thin; may be underbuilt or blocked.");
  } catch (error) {
    warnings.push(`Could not fetch website: ${error instanceof Error ? error.message : "unknown error"}`);
    signals.push("Website could not be inspected automatically.");
  }

  return { html, signals, warnings };
}

function inferChecks(input: AuditInput, html: string, signals: string[]): AuditChecks {
  const notes = `${input.notes ?? ""} ${signals.join(" ")}`.toLowerCase();
  const lowerHtml = html.toLowerCase();
  const combined = `${notes} ${lowerHtml}`;
  const hasWebsite = Boolean(input.websiteUrl?.trim());

  return {
    hasWebsite,
    outdatedWebsite: hasWebsite
      ? /outdated|old|broken|slow|not secure|http only|flash|copyright 20(0\d|1\d)|under construction/.test(combined) || !/<meta[^>]+name=["']viewport["']/i.test(html)
      : true,
    mobileFriendly: /viewport meta tag found|mobile friendly|responsive/.test(notes) || /<meta[^>]+name=["']viewport["']/i.test(html),
    clearCta: /book|schedule|appointment|quote|estimate|call now|contact us|get started/.test(combined),
    phoneEasyToFind: /phone number|tel:|\(\d{3}\)\s?\d{3}-\d{4}|\d{3}[-.\s]\d{3}[-.\s]\d{4}/.test(combined),
    reviewsVisible: /review|testimonial|stars|yelp|google reviews/.test(combined),
    onlineBooking: /book online|schedule online|appointment|calendly|acuity|squareup|booking/.test(combined),
    trustSection: /licensed|insured|certified|guarantee|trusted|years|family owned|testimonial/.test(combined),
    gallery: /gallery|portfolio|before|after|photos|projects|instagram/.test(combined),
    serviceList: /service|services|what we do|repair|cleaning|landscaping|detailing|menu/.test(combined),
    pricing: /price|pricing|packages|rates|starting at|from \$/.test(combined),
    faq: /faq|frequently asked|questions/.test(combined),
  };
}

function scoreLead(checks: AuditChecks, input: AuditInput) {
  let score = 55;
  if (!checks.hasWebsite) score += 25;
  if (checks.outdatedWebsite) score += 14;
  if (!checks.mobileFriendly) score += 10;
  if (!checks.clearCta) score += 10;
  if (!checks.phoneEasyToFind) score += 8;
  if (!checks.reviewsVisible) score += 6;
  if (!checks.onlineBooking) score += 7;
  if (!checks.gallery) score += 4;
  if (!checks.serviceList) score += 4;
  if (!checks.trustSection) score += 4;
  if (!checks.pricing) score += 3;
  if (!checks.faq) score += 2;
  if (input.googleProfileUrl?.trim()) score += 3;
  return Math.max(1, Math.min(100, score));
}

function packageName(score: number, checks: AuditChecks) {
  if (!checks.hasWebsite || score >= 86) return "Presence Labs Launch Package";
  if (score >= 72) return "Presence Labs Conversion Upgrade";
  return "Presence Labs Local Trust Tune-Up";
}

function estimateAnnualLoss(category: string) {
  const lower = category.toLowerCase();
  if (/restaurant|food/.test(lower)) return 20_000;
  if (/contractor|roof|plumb|electric|hvac|home/.test(lower)) return 15_000;
  if (/mechanic|auto|repair/.test(lower)) return 12_000;
  if (/landscap|lawn/.test(lower)) return 10_000;
  if (/clean/.test(lower)) return 8_000;
  if (/detail/.test(lower)) return 5_000;
  if (/barber|salon/.test(lower)) return 4_000;
  return 7_500;
}

function localAssets(input: AuditInput, checks: AuditChecks, score: number): GeneratedAssets {
  const category = input.category?.trim() || "local business";
  const location = input.location?.trim() || "the Bay Area";
  const name = input.businessName.trim();
  const ownerFirst = input.ownerName?.trim().split(" ")[0] ?? "";

  // Build specific gap list with impact language
  const gapDetails: Array<{ short: string; impact: string }> = [
    !checks.hasWebsite && { short: "no website", impact: "customers searching online can't find or trust the business" },
    checks.outdatedWebsite && { short: "outdated site", impact: "poor first impression on mobile — visitors bounce before calling" },
    !checks.mobileFriendly && { short: "not mobile-optimized", impact: "over 70% of local searches are mobile; a broken mobile experience kills calls" },
    !checks.clearCta && { short: "no clear call-to-action", impact: "visitors don't know what to do next so they leave" },
    !checks.phoneEasyToFind && { short: "phone number hard to find", impact: "high-intent customers give up and call a competitor" },
    !checks.reviewsVisible && { short: "no visible reviews", impact: "no social proof means lower trust and fewer conversions" },
    !checks.onlineBooking && { short: "no booking option", impact: "customers who want to act now can't, so they move on" },
    !checks.gallery && { short: "no photo gallery", impact: "without visual proof, customers can't picture the work quality" },
    !checks.serviceList && { short: "services not listed", impact: "confused visitors don't convert — they need to know exactly what you offer" },
    !checks.trustSection && { short: "missing trust signals", impact: "no license, guarantee, or credentials visible to reduce buyer hesitation" },
    !checks.pricing && { short: "no pricing guidance", impact: "buyers who can't estimate cost often don't bother asking" },
  ].filter(Boolean) as Array<{ short: string; impact: string }>;

  const topGaps = gapDetails.slice(0, 4);
  const topShort = topGaps.map((g) => g.short);
  const topImpact = topGaps.slice(0, 2).map((g) => g.impact);

  const annualLoss = estimateAnnualLoss(category);
  const monthlyLoss = Math.round(annualLoss / 12);
  const offer = packageName(score, checks);

  const callGreeting = ownerFirst ? `Hey ${ownerFirst}` : `Hey, is this the owner of ${name}`;
  const writtenGreeting = ownerFirst ? `Hi ${ownerFirst}` : "Hi";

  // Pain summary: specific, punchy, consultative
  const pain = topGaps.length > 0
    ? `${name} has ${topGaps.length} key online-presence gaps: ${topShort.join(", ")}. The biggest revenue risks: ${topImpact.slice(0, 2).join("; ")}. For a ${category} business in ${location}, these gaps likely cost $${monthlyLoss.toLocaleString()}+ per month in missed calls and lost quotes.`
    : `${name} has a solid online foundation but conversion gaps in the final 20% that turn visitors into paying customers. Small fixes to trust signals and CTAs could meaningfully increase call volume.`;

  // Cold call: short, punchy, specific observation
  const callObservation = topShort[0] ? `one thing that jumped out was ${topShort[0]}` : "a few conversion gaps that may be costing calls";
  const coldCallScript = `${callGreeting}? This is Hamid with Presence Labs — I do local web presence for ${category} businesses in ${location}. I was reviewing ${name} and ${callObservation}${topShort[1] ? ` and ${topShort[1]}` : ""}. That kind of thing can quietly bleed calls every week. I put together a quick 1-page audit — would it be okay if I texted it over? Takes 2 minutes to look at and it's free.`;

  // SMS: ultra short, curiosity hook
  const textMessageScript = `${ownerFirst ? `Hey ${ownerFirst}` : "Hey"} — Hamid here from Presence Labs. I checked ${name}'s online presence and spotted ${topShort[0] ?? "a few quick wins"} that could turn more Google visitors into calls. Mind if I send a free 1-pager? Takes 2 min to read.`;

  // Email: professional, specific, low-pressure
  const bulletGaps = topGaps.slice(0, 4).map((g) => `• ${g.short} — ${g.impact}`).join("\n");
  const emailScript = `Subject: Found a few quick wins for ${name}\n\n${writtenGreeting},\n\nI was researching local ${category} businesses in ${location} and looked at ${name}'s online presence. A few things stood out that may be costing you calls:\n\n${bulletGaps || "• Conversion gaps that reduce how many visitors become customers"}\n\nThese are fixable — and the upside for a ${category} business in ${location} is typically $${monthlyLoss.toLocaleString()}/month+ in recovered leads.\n\nPresence Labs builds local business websites that fix exactly these issues: mobile-first, fast, with clear CTAs, trust sections, service pages, and review proof.\n\nI put together a quick audit for ${name}. Want me to send it over?\n\nBest,\nHamid\nPresence Labs`;

  // 30-second pitch: specific to the gaps found
  const thirtySecondPitch = topGaps.length > 0
    ? `${name} already gets local search traffic, but ${topShort.slice(0, 2).join(" and ")} is likely causing visitors to leave before calling. Presence Labs fixes those exact gaps — clean mobile site, visible trust proof, clear CTAs — so the traffic ${name} already gets actually converts into calls and booked jobs. Most clients recover the investment in the first 4-6 weeks.`
    : `${name} has a solid presence but the final conversion layer — trust signals, clear CTAs, social proof — can be tightened. Presence Labs handles that refresh so more of the traffic you already get actually calls.`;

  // Follow-up: value-first, not pushy
  const followUpMessage = `${ownerFirst ? `Hey ${ownerFirst}` : "Hey"} — quick follow-up. I finished the audit for ${name} and found ${topGaps.length > 0 ? `${topGaps.length} specific gaps including ${topShort[0]}` : "a few conversion improvements worth making"}. I can walk you through it in 10 minutes. Want me to send it over?`;

  return {
    leadScore: score,
    painPointSummary: pain,
    recommendedPackage: offer,
    likelyMoneyLost: `${name} is likely losing $${monthlyLoss.toLocaleString()}–$${(monthlyLoss * 2).toLocaleString()}/month in missed calls and lost quote requests. ${category.charAt(0).toUpperCase() + category.slice(1)} businesses in ${location} compete heavily on first impression, trust, and ease of contact. Customers comparing 2-3 options choose the business that looks most credible and makes it easiest to act — that's often not ${name} right now.`,
    presenceLabsOffer: `${offer}: a complete local business web presence built to convert — mobile-first design, service pages, gallery, review proof, trust section, FAQ, click-to-call, and Google-optimized structure. Delivered in 2–3 weeks, built for ${category} businesses in ${location}.`,
    estimatedAnnualLoss: annualLoss,
    coldCallScript,
    textMessageScript,
    emailScript,
    thirtySecondPitch,
    followUpMessage,
    proposalOutline: [
      `Current online presence snapshot for ${name}`,
      `Top ${topGaps.length > 0 ? topGaps.length : "4"} conversion gaps and estimated revenue impact`,
      `Recommended solution: ${offer}`,
      "Deliverables: mobile site, service pages, gallery, trust section, CTAs, review proof",
      "Timeline: 2–3 weeks to launch | Investment & next steps",
    ],
  };
}

function parseModelJson(text: string): GeneratedAssets {
  const cleaned = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  const jsonCandidate =
    firstBrace >= 0 && lastBrace > firstBrace ? cleaned.slice(firstBrace, lastBrace + 1) : cleaned;
  return JSON.parse(jsonCandidate) as GeneratedAssets;
}

async function claudeAssets(input: AuditInput, checks: AuditChecks, local: GeneratedAssets, signals: string[]) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const prompt = `You are a practical local-business sales strategist for Presence Labs. Return ONLY valid JSON matching this TypeScript type: {leadScore:number,painPointSummary:string,recommendedPackage:string,likelyMoneyLost:string,presenceLabsOffer:string,estimatedAnnualLoss:number,coldCallScript:string,textMessageScript:string,emailScript:string,thirtySecondPitch:string,followUpMessage:string,proposalOutline:string[]}.

Business input: ${JSON.stringify(input)}
Audit checks: ${JSON.stringify(checks)}
Website signals: ${JSON.stringify(signals)}
Baseline draft: ${JSON.stringify(local)}

Make it specific, concise, ethical, and useful for converting this lead. leadScore must be 1-100.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
      max_tokens: 1400,
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude generation failed with HTTP ${response.status}`);
  }

  const payload = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const text = payload.content?.find((item) => item.type === "text" && item.text)?.text?.trim() ?? "";
  if (!text) {
    throw new Error("Claude returned empty content");
  }

  return parseModelJson(text);
}

async function geminiAssets(input: AuditInput, checks: AuditChecks, local: GeneratedAssets, signals: string[]) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `You are a practical local-business sales strategist for Presence Labs. Return ONLY valid JSON matching this TypeScript type: {leadScore:number,painPointSummary:string,recommendedPackage:string,likelyMoneyLost:string,presenceLabsOffer:string,estimatedAnnualLoss:number,coldCallScript:string,textMessageScript:string,emailScript:string,thirtySecondPitch:string,followUpMessage:string,proposalOutline:string[]}.

Business input: ${JSON.stringify(input)}
Audit checks: ${JSON.stringify(checks)}
Website signals: ${JSON.stringify(signals)}
Baseline draft: ${JSON.stringify(local)}

Make it specific, concise, ethical, and useful for converting this lead. leadScore must be 1-100.`;

  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
    contents: prompt,
  });
  const text = response.text?.trim() ?? "";
  return parseModelJson(text);
}

export async function generateAudit(rawInput: AuditInput): Promise<AuditResult> {
  const input = inputSchema.parse(rawInput);
  const { html, signals, warnings } = await fetchWebsiteSignals(input.websiteUrl);
  const checks = inferChecks(input, html, signals);
  const score = scoreLead(checks, input);
  const local = localAssets(input, checks, score);

  try {
    const claude = await claudeAssets(input, checks, local, signals);
    if (claude) {
      return { checks, assets: { ...claude, leadScore: Math.max(1, Math.min(100, Number(claude.leadScore) || score)) }, websiteSignals: signals, warnings, source: "claude" };
    }
  } catch (error) {
    warnings.push(`Claude generation failed; trying Gemini/local fallback: ${error instanceof Error ? error.message : "unknown error"}`);
  }

  try {
    const gemini = await geminiAssets(input, checks, local, signals);
    if (gemini) {
      return { checks, assets: { ...gemini, leadScore: Math.max(1, Math.min(100, Number(gemini.leadScore) || score)) }, websiteSignals: signals, warnings, source: "gemini" };
    }
  } catch (error) {
    warnings.push(`Gemini generation failed; used local fallback: ${error instanceof Error ? error.message : "unknown error"}`);
  }

  const categoryInsight = Object.entries(businessCategoryDefaults).find(([key]) =>
    `${input.category ?? ""} ${input.notes ?? ""}`.toLowerCase().includes(key),
  )?.[1];
  if (categoryInsight) warnings.push(categoryInsight);

  return { checks, assets: local, websiteSignals: signals, warnings, source: "local-fallback" };
}
