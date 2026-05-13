import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2, ExternalLink, MapPin, ShieldCheck, Sparkles, Star, XCircle } from "lucide-react";
import { AuditViewTracker } from "@/components/audit-view-tracker";
import { PaymentIntentLink } from "@/components/payment-intent-link";
import { PrintButton } from "@/components/print-button";
import { prisma } from "@/lib/prisma";
import { estimatedDealValue, formatMoney } from "@/lib/money";
import { formatRelativeTime } from "@/lib/utils";
import type { AuditChecks, GeneratedAssets } from "@/lib/types";
import { verifyAuditAccessToken } from "@/lib/audit-links";
import { isAuthEnabled } from "@/lib/env";

const labels: Array<[keyof AuditChecks, string, string]> = [
  ["hasWebsite", "Website presence", "A real website customers can trust"],
  ["mobileFriendly", "Mobile friendly", "Clean experience on phones"],
  ["clearCta", "Clear CTA", "Obvious next step to call/book"],
  ["phoneEasyToFind", "Phone visible", "Phone number is easy to find"],
  ["reviewsVisible", "Reviews visible", "Social proof is shown"],
  ["onlineBooking", "Online booking", "Customers can book/request quickly"],
  ["trustSection", "Trust signals", "Licenses, guarantees, proof"],
  ["gallery", "Gallery/proof", "Photos or project examples"],
  ["serviceList", "Services listed", "Clear offer/service menu"],
  ["pricing", "Pricing/packages", "Pricing guidance or packages"],
  ["faq", "FAQ", "Answers common objections"],
];

const deliverableMap: Partial<Record<keyof AuditChecks, { title: string; detail: string }>> = {
  hasWebsite: { title: "Professional 5-page website", detail: "Home, Services, About, Reviews, and Contact pages — built to convert visitors into calls." },
  mobileFriendly: { title: "Mobile-first redesign", detail: "Fast-loading, sharp on any phone — because 70%+ of local searches happen on mobile." },
  clearCta: { title: "Clear call-to-action on every page", detail: "Book Now / Get a Free Quote / Call Today buttons strategically placed throughout." },
  phoneEasyToFind: { title: "Click-to-call phone in header & footer", detail: "Phone number visible above the fold on every page so customers never hunt for it." },
  reviewsVisible: { title: "Review showcase section", detail: "Your best Google reviews displayed prominently to build instant trust with new visitors." },
  onlineBooking: { title: "Online booking or quote request form", detail: "Customers can request a quote or book directly — with email notifications to you." },
  trustSection: { title: "Trust signals section", detail: "License info, years in business, guarantees, and industry badges — answers 'why you?' before they ask." },
  gallery: { title: "Photo gallery (up to 20 images)", detail: "Project photos, before/afters, or portfolio images that prove the quality of your work." },
  serviceList: { title: "Dedicated service pages", detail: "A clear services menu with a page for each offering you provide — helps Google and customers understand exactly what you do." },
  pricing: { title: "Pricing or packages page", detail: "Transparent pricing or package tiers that help customers self-qualify and reduce back-and-forth." },
  faq: { title: "FAQ section", detail: "Answers the top 5 questions and objections before they're asked — so fewer leads fall off." },
};

const alwaysDeliverables = [
  { title: "Google Business Profile optimization", detail: "Updated photos, services, description, and category targeting for better local map rankings." },
  { title: "Local SEO foundation", detail: "Title tags, meta descriptions, and schema markup so Google can correctly show your site to nearby searchers." },
  { title: "30-day revision window", detail: "After launch, you get 30 days of included edits — no extra charge." },
];

function scoreCopy(score: number) {
  if (score >= 85) return { label: "High opportunity", className: "bg-rose-500 text-white", copy: "This business has clear conversion gaps that can likely be turned into more calls, quotes, and booked jobs." };
  if (score >= 70) return { label: "Strong opportunity", className: "bg-amber-400 text-slate-950", copy: "This business has several fixable online-presence gaps that may be limiting customer action." };
  return { label: "Moderate opportunity", className: "bg-lime-300 text-slate-950", copy: "This business has a foundation to build on, with targeted improvements available." };
}

export default async function ClientAuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const token = query.token ? String(query.token) : "";
  if (isAuthEnabled() && !verifyAuditAccessToken(token, id)) {
    notFound();
  }
  const lead = await prisma.lead.findUnique({ where: { id }, include: { attachedCaseStudy: true } });
  if (!lead) notFound();

  const audit = JSON.parse(lead.auditJson) as { checks: AuditChecks; websiteSignals: string[]; warnings: string[]; source: string };
  const assets = JSON.parse(lead.assetsJson) as GeneratedAssets;
  const tone = scoreCopy(lead.score);
  const selectedPackage = lead.packageName || assets.recommendedPackage;
  const selectedPrice = estimatedDealValue(selectedPackage, lead.customPrice);
  const passed = labels.filter(([key]) => audit.checks[key]).length;
  const failed = labels.length - passed;
  const deliverables = [
    ...labels
      .filter(([key]) => !audit.checks[key])
      .map(([key]) => deliverableMap[key])
      .filter((d): d is { title: string; detail: string } => Boolean(d)),
    ...alwaysDeliverables,
  ];

  return (
    <main className="min-h-screen bg-[#f5f7f2] text-slate-950">
      <AuditViewTracker leadId={lead.id} />
      <section className="relative overflow-hidden bg-slate-950 px-5 py-8 text-white sm:px-8 lg:px-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(190,242,100,0.24),transparent_30%),radial-gradient(circle_at_85%_10%,rgba(255,255,255,0.09),transparent_24%)]" />
        <div className="relative mx-auto max-w-6xl">
          <nav className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-lime-300">Presence Labs</p>
              <p className="mt-1 text-sm text-white/55">Local Presence Audit</p>
            </div>
            <PrintButton />
          </nav>

          <div className="grid gap-10 py-14 lg:grid-cols-[1fr_320px] lg:items-end">
            <div>
              <div className="flex flex-wrap gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-lime-300/25 bg-lime-300/10 px-4 py-2 text-sm font-bold text-lime-100">
                  <Sparkles className="size-4" /> Prepared for {lead.businessName}
                </div>
                <div className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-white/60">
                  Last updated: {formatRelativeTime(lead.updatedAt)}
                </div>
              </div>
              <h1 className="mt-6 max-w-4xl text-5xl font-black tracking-tight sm:text-7xl">Online presence audit</h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-white/65">A focused review of how easily customers can trust, understand, and contact this business online.</p>
              <div className="mt-7 flex flex-wrap gap-3 text-sm font-semibold text-white/70">
                {lead.category ? <span className="rounded-full bg-white/10 px-4 py-2">{lead.category}</span> : null}
                {lead.location ? <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2"><MapPin className="size-4" />{lead.location}</span> : null}
                {lead.websiteUrl ? <a href={lead.websiteUrl} target="_blank" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 hover:bg-white/15">Website <ExternalLink className="size-4" /></a> : null}
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/10 p-6 text-center backdrop-blur-xl">
              <div className={`mx-auto flex size-32 items-center justify-center rounded-[2rem] text-5xl font-black ${tone.className}`}>{lead.score}</div>
              <p className="mt-5 text-xl font-black">{tone.label}</p>
              <p className="mt-3 text-sm leading-6 text-white/60">{tone.copy}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-10 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-lime-700">Audit summary</p>
            <h2 className="mt-3 text-3xl font-black">What the online presence should do better</h2>
            <p className="mt-4 text-sm leading-6 text-slate-600">A strong local business website should quickly prove credibility, explain services, and make it effortless for a customer to call, book, or request a quote.</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-3xl bg-lime-50 p-5">
                <p className="text-4xl font-black text-lime-700">{passed}</p>
                <p className="mt-1 text-sm font-bold text-slate-600">Strengths found</p>
              </div>
              <div className="rounded-3xl bg-rose-50 p-5">
                <p className="text-4xl font-black text-rose-600">{failed}</p>
                <p className="mt-1 text-sm font-bold text-slate-600">Gaps to improve</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {labels.map(([key, title, description]) => {
              const ok = audit.checks[key];
              return (
                <div key={key} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    {ok ? <CheckCircle2 className="mt-0.5 size-6 text-lime-600" /> : <XCircle className="mt-0.5 size-6 text-rose-500" />}
                    <div>
                      <h3 className="font-black">{title}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-5 pb-6 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-6xl rounded-[2rem] border border-amber-200 bg-gradient-to-br from-amber-50 to-rose-50 p-6 shadow-sm">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-amber-700">Opportunity cost</p>
          <h2 className="mt-3 text-3xl font-black">The cost of inaction</h2>
          {assets.estimatedAnnualLoss ? <p className="mt-4 inline-flex rounded-full bg-rose-600 px-4 py-2 text-sm font-black text-white">Estimated revenue leak: ${assets.estimatedAnnualLoss.toLocaleString()}/year</p> : null}
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div className="rounded-3xl bg-white/75 p-5 ring-1 ring-amber-100">
              <h3 className="font-black text-slate-950">What is probably leaking revenue</h3>
              <p className="mt-3 text-sm leading-7 text-slate-700">{assets.painPointSummary}</p>
            </div>
            <div className="rounded-3xl bg-white/75 p-5 ring-1 ring-rose-100">
              <h3 className="font-black text-slate-950">Likely money left on the table</h3>
              <p className="mt-3 text-sm leading-7 text-slate-700">{assets.likelyMoneyLost}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Deliverables Section */}
      {deliverables.length > 0 && (
        <section className="px-5 pb-6 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-6xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-lime-700">🛠️ What Presence Labs will build</p>
            <h2 className="mt-3 text-3xl font-black">Your complete fix list</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">Based on this audit, here is exactly what Presence Labs will deliver — no guesswork, no vague scope.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {deliverables.map((item, i) => (
                <div key={i} className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-lime-600" />
                  <div>
                    <p className="text-sm font-black text-slate-950">{item.title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="px-5 pb-14 sm:px-8 lg:px-12">
        <div className="mx-auto mb-6 max-w-6xl rounded-[2rem] bg-lime-300 p-6 text-slate-950 shadow-sm">
          <h2 className="text-3xl font-black">Want this fixed?</h2>
          <p className="mt-3 max-w-3xl text-sm font-bold leading-7 text-slate-800">Presence Labs can turn this audit into a focused action plan and a cleaner online presence built to generate more calls, quote requests, and booked jobs.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            {lead.stripePaymentUrl ? <PaymentIntentLink leadId={lead.id} href={lead.stripePaymentUrl} className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800">Secure this package <ArrowRight className="size-4" /></PaymentIntentLink> : null}
            <a href={process.env.NEXT_PUBLIC_CALENDLY_URL || "mailto:hello@presencelabs.ai?subject=Strategy%20Call%20for%20Local%20Presence%20Audit"} className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-lime-50">Schedule a strategy call <ArrowRight className="size-4" /></a>
          </div>
        </div>
        {lead.attachedCaseStudy ? <div className="mx-auto mb-6 max-w-6xl rounded-[2rem] border border-lime-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-lime-700">Recent Success</p>
          <h2 className="mt-3 text-3xl font-black">{lead.attachedCaseStudy.title}</h2>
          <p className="mt-3 inline-flex rounded-full bg-lime-300 px-4 py-2 text-sm font-black text-slate-950">{lead.attachedCaseStudy.result}</p>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">{lead.attachedCaseStudy.description}</p>
        </div> : null}
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-2">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <ShieldCheck className="size-10 text-lime-700" />
            <h2 className="mt-5 text-3xl font-black">Recommended Presence Labs package</h2>
            <p className="mt-4 text-lg font-black text-lime-700">{selectedPackage}</p>
            <p className="mt-3 inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white">Recommended investment: {formatMoney(selectedPrice)}</p>
            <p className="mt-4 text-sm leading-7 text-slate-600">{assets.presenceLabsOffer}</p>
          </div>
          <div className="rounded-[2rem] bg-slate-950 p-6 text-white shadow-sm">
            <Star className="size-10 fill-lime-300 text-lime-300" />
            <h2 className="mt-5 text-3xl font-black">Suggested next step</h2>
            <p className="mt-4 text-sm leading-7 text-white/65">Start with a focused conversion upgrade: clarify services, add trust proof, improve mobile calls-to-action, and create a cleaner path from Google search to booked customer.</p>
            <a href="mailto:hello@presencelabs.ai?subject=Local%20business%20audit" className="mt-7 inline-flex items-center gap-2 rounded-full bg-lime-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-lime-200">Book a discovery call <ArrowRight className="size-4" /></a>
          </div>
        </div>
      </section>
    </main>
  );
}
