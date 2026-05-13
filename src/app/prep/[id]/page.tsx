import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckSquare, DollarSign, ExternalLink, MapPin, ShieldAlert, Sparkles, Star, User } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { estimatedDealValue, formatMoney } from "@/lib/money";
import type { AuditChecks, GeneratedAssets } from "@/lib/types";
import { MeetingPrepCopyButtons } from "@/components/meeting-prep-copy-buttons";
import { generateObjectionResponses } from "@/lib/objections";

export const dynamic = "force-dynamic";

const auditLabels: Array<[keyof AuditChecks, string]> = [
  ["hasWebsite", "Has a real website"],
  ["mobileFriendly", "Mobile friendly"],
  ["clearCta", "Clear call-to-action"],
  ["phoneEasyToFind", "Phone easy to find"],
  ["reviewsVisible", "Reviews visible"],
  ["onlineBooking", "Online booking"],
  ["trustSection", "Trust signals"],
  ["gallery", "Gallery / proof"],
  ["serviceList", "Services listed"],
  ["pricing", "Pricing shown"],
  ["faq", "FAQ present"],
];

export default async function MeetingPrepPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await prisma.lead.findUnique({ where: { id }, include: { attachedCaseStudy: true } });
  if (!lead) notFound();

  const assets = JSON.parse(lead.assetsJson) as GeneratedAssets;
  const audit = JSON.parse(lead.auditJson) as { checks: AuditChecks; websiteSignals: string[]; warnings: string[]; source: string };
  const price = estimatedDealValue(lead.packageName, lead.customPrice);
  const failedChecks = auditLabels.filter(([key]) => !audit.checks[key]);
  const objections = generateObjectionResponses(lead.businessName, assets, lead.packageName);

  const confirmationEmail = `Subject: Quick follow-up — ${lead.businessName} presence audit

Hi${lead.ownerName ? ` ${lead.ownerName}` : ""},

Thanks for taking the time to connect. As promised, I've put together a full online presence audit for ${lead.businessName}.

Here's what I found:
${failedChecks.slice(0, 3).map(([, label]) => `• ${label} — not currently in place`).join("\n")}

The recommended solution is the ${lead.packageName} at ${formatMoney(price)}.

You can review the full audit here:
[audit link]

I'll follow up shortly to answer any questions and walk you through next steps.

Best,
Hamid
Presence Labs`;

  return (
    <main className="min-h-screen bg-[#f5f7f2] text-slate-950">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/90 px-5 py-5 backdrop-blur-xl sm:px-8">
        <div className="mx-auto max-w-3xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50">
              <ArrowLeft className="size-3.5" /> Dashboard
            </Link>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-lime-700">Meeting Prep</p>
              <h1 className="text-lg font-black">{lead.businessName}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            {lead.category && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{lead.category}</span>}
            {lead.location && <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold"><MapPin className="size-3" />{lead.location}</span>}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-5 px-5 py-8 sm:px-8">

        {/* Deal snapshot */}
        <div className="rounded-[2rem] bg-slate-950 p-6 text-white">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-white/50">Package</p>
              <p className="mt-1 font-black leading-tight">{lead.packageName}</p>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-white/50">Investment</p>
              <p className="mt-1 text-2xl font-black text-lime-300">{formatMoney(price)}</p>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-white/50">Lead Score</p>
              <p className="mt-1 text-2xl font-black">{lead.score}<span className="text-base font-bold text-white/40">/10</span></p>
            </div>
          </div>
          {lead.ownerName && (
            <div className="mt-4 flex items-center gap-2 border-t border-white/10 pt-4">
              <User className="size-4 text-white/40" />
              <p className="text-sm font-bold text-white/70">Decision maker: <span className="text-white">{lead.ownerName}</span></p>
            </div>
          )}
          {lead.phone && (
            <div className="mt-2">
              <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-2 rounded-xl bg-lime-300 px-4 py-2 text-xs font-black text-slate-950 transition hover:bg-lime-200">
                Call {lead.phone}
              </a>
            </div>
          )}
          {lead.stripePaymentUrl && (
            <div className="mt-2">
              <a href={lead.stripePaymentUrl} target="_blank" className="inline-flex items-center gap-1.5 rounded-xl border border-lime-300/30 px-3 py-2 text-xs font-black text-lime-300 transition hover:bg-white/10">
                <DollarSign className="size-3.5" /> Payment link ready ↗
              </a>
            </div>
          )}
        </div>

        {/* 30-second pitch */}
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-lime-600" />
              <h2 className="font-black">30-Second Pitch</h2>
            </div>
            <MeetingPrepCopyButtons label="Copy pitch" text={assets.thirtySecondPitch} />
          </div>
          <p className="mt-4 text-sm leading-relaxed text-slate-700 rounded-2xl bg-lime-50 p-4 border border-lime-100">{assets.thirtySecondPitch}</p>
        </div>

        {/* Pain summary */}
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-black">Pain Summary</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-700">{lead.painSummary}</p>
          {failedChecks.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-400 mb-2">Key gaps to mention</p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {failedChecks.map(([, label]) => (
                  <div key={label} className="flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                    <span className="size-1.5 rounded-full bg-rose-400 shrink-0" />
                    {label}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Proposal outline */}
        {assets.proposalOutline?.length > 0 && (
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CheckSquare className="size-5 text-slate-600" />
                <h2 className="font-black">Proposal Outline</h2>
              </div>
              <MeetingPrepCopyButtons label="Copy outline" text={assets.proposalOutline.join("\n")} />
            </div>
            <ol className="mt-4 space-y-2">
              {assets.proposalOutline.map((point, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-black text-white">{i + 1}</span>
                  <span className="text-slate-700 leading-relaxed">{point}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* What they get */}
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-black">What They Get</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-700">{assets.presenceLabsOffer}</p>
          <p className="mt-3 text-xs text-slate-500 italic">{assets.likelyMoneyLost}</p>
        </div>

        {/* Case study */}
        {lead.attachedCaseStudy && (
          <div className="rounded-[2rem] border border-lime-200 bg-lime-50 p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <Star className="size-5 text-lime-600 fill-lime-400" />
              <h2 className="font-black text-lime-900">Success Story to Reference</h2>
            </div>
            <p className="mt-3 text-lg font-black text-lime-900">{lead.attachedCaseStudy.result}</p>
            <p className="mt-2 font-bold text-lime-800">{lead.attachedCaseStudy.title}</p>
            <p className="mt-1 text-sm text-lime-700 leading-relaxed">{lead.attachedCaseStudy.description}</p>
          </div>
        )}

        {/* Confirmation email */}
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-black">Post-Call Confirmation Email</h2>
            <MeetingPrepCopyButtons label="Copy email" text={confirmationEmail} />
          </div>
          <pre className="mt-4 whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-xs text-slate-700 leading-relaxed font-mono">{confirmationEmail}</pre>
        </div>

        {/* Objection Handler */}
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <ShieldAlert className="size-5 text-orange-500" />
            <h2 className="font-black">Objection Handler</h2>
            <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-black text-orange-700">5 scripts</span>
          </div>
          <div className="space-y-4">
            {objections.map((item, i) => (
              <details key={i} className="group rounded-2xl border border-slate-100 bg-slate-50 open:bg-orange-50 open:border-orange-200 transition-colors">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
                  <p className="text-sm font-black text-slate-800">&ldquo;{item.objection}&rdquo;</p>
                  <span className="shrink-0 text-slate-400 group-open:rotate-180 transition-transform">&#9662;</span>
                </summary>
                <div className="px-4 pb-4 space-y-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-orange-600 mb-1.5">Your response</p>
                    <p className="text-sm leading-relaxed text-slate-700">{item.response}</p>
                  </div>
                  <div className="rounded-xl bg-white border border-orange-100 px-3 py-2">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-400 mb-1">Follow-up question</p>
                    <p className="text-sm font-bold text-slate-700 italic">&ldquo;{item.followUp}&rdquo;</p>
                  </div>
                  <MeetingPrepCopyButtons label="Copy response" text={`${item.response}\n\n${item.followUp}`} />
                </div>
              </details>
            ))}
          </div>
        </div>

        {/* Audit link */}
        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm flex items-center justify-between gap-4">
          <div>
            <p className="font-black">Shareable Audit Report</p>
            <p className="text-xs text-slate-500 mt-0.5">Send this link to the prospect after the call</p>
          </div>
          <a href={`/audit/${lead.id}`} target="_blank" className="inline-flex h-10 items-center gap-2 rounded-2xl bg-slate-950 px-4 text-xs font-black text-white transition hover:bg-slate-800 shrink-0">
            Open Audit <ExternalLink className="size-3.5" />
          </a>
        </div>

      </div>
    </main>
  );
}
