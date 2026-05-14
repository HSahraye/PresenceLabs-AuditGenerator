"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { ArrowLeft, ExternalLink, Loader2, Mail, MessageSquareText, Phone, SkipForward } from "lucide-react";
import { logOutreachAction, updateLeadStatusAction } from "@/app/actions/leads";
import { sanitizePublicBrandCopy } from "@/lib/branding";
import { buildMailtoHref, buildSmsHref } from "@/lib/communication/links";
import { getOutreachAngles, getPrimaryPainPoints } from "@/lib/intelligence/selectors";
import type { GeneratedAssets } from "@/lib/types";

type OutreachLead = {
  id: string;
  businessName: string;
  ownerName: string | null;
  category: string | null;
  location: string | null;
  websiteUrl: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  score: number;
  publicAuditPath: string;
  painSummary: string;
  assetsJson: string;
  intelligenceJson: string | null;
  nextFollowUpAt: string | null;
  lastContactedAt: string | null;
  viewCount: number;
  lastViewedAt: string | null;
  paymentClickCount: number;
  lastPaymentClickedAt: string | null;
};

type LeadView = OutreachLead & { assets: GeneratedAssets };

function nextFollowUpDate(days = 3) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function OutreachView({ leads, publicBaseUrl }: { leads: OutreachLead[]; publicBaseUrl: string }) {
  const parsedLeads = useMemo<LeadView[]>(
    () =>
      leads.map((lead) => {
        const parsed = JSON.parse(lead.assetsJson) as GeneratedAssets;
        return {
          ...lead,
          assets: {
            ...parsed,
            coldCallScript: sanitizePublicBrandCopy(parsed.coldCallScript),
            textMessageScript: sanitizePublicBrandCopy(parsed.textMessageScript),
            emailScript: sanitizePublicBrandCopy(parsed.emailScript),
            thirtySecondPitch: sanitizePublicBrandCopy(parsed.thirtySecondPitch),
            followUpMessage: sanitizePublicBrandCopy(parsed.followUpMessage),
          },
        };
      }),
    [leads],
  );
  const [index, setIndex] = useState(0);
  const [error, setError] = useState("");
  const [doneCount, setDoneCount] = useState(0);
  const [isPending, startTransition] = useTransition();
  const lead = parsedLeads[index];
  const auditUrl = lead ? `${publicBaseUrl}${lead.publicAuditPath}` : "";
  const smsUrl = lead?.phone ? buildSmsHref(lead.phone, `${lead.assets.textMessageScript}\n\nAudit: ${auditUrl}`) : "";
  const emailUrl = lead ? buildMailtoHref(`Quick online presence audit for ${lead.businessName}`, `${lead.assets.emailScript}\n\nAudit: ${auditUrl}`) : "";

  const goNext = () => setIndex((current) => Math.min(current + 1, parsedLeads.length - 1));
  const goPrev = () => setIndex((current) => Math.max(0, current - 1));
  const goTo = (target: number) => setIndex(Math.max(0, Math.min(parsedLeads.length - 1, target)));

  const logAndNext = (type: "Call" | "SMS" | "Email", notes: string) => {
    if (!lead) return;
    setError("");
    startTransition(async () => {
      const result = await logOutreachAction(lead.id, type, notes, nextFollowUpDate(3));
      if (!result.ok) {
        setError(result.error ?? "Could not log outreach.");
        return;
      }
      setDoneCount((count) => count + 1);
      goNext();
    });
  };

  const skipAndNext = () => {
    if (!lead) return;
    setError("");
    startTransition(async () => {
      const result = await updateLeadStatusAction(lead.id, "Follow-up");
      if (!result.ok) {
        setError(result.error ?? "Could not skip lead.");
        return;
      }
      goNext();
    });
  };

  return (
    <main className="min-h-screen bg-[#f5f7f2] text-slate-950">
      <header className="border-b border-slate-200 bg-white/80 px-5 py-5 backdrop-blur-xl sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500 hover:text-slate-950"><ArrowLeft className="size-4" /> Dashboard</Link>
            <p className="mt-3 text-xs font-black uppercase tracking-[0.28em] text-lime-700">Call Today</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Outreach Focus Mode</h1>
          </div>
          <div className="rounded-2xl bg-slate-950 px-4 py-3 text-white"><p className="text-xs text-white/50">Progress</p><p className="font-black">{doneCount}/{parsedLeads.length} logged</p></div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-6 sm:px-8 lg:px-12">
        {!lead ? <div className="rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-sm"><h2 className="text-3xl font-black">No more call-today leads.</h2><p className="mt-3 text-slate-500">Add leads, generate audits, or set follow-up dates to fill this queue.</p><Link href="/research" className="mt-6 inline-flex rounded-2xl bg-lime-300 px-5 py-3 text-sm font-black text-slate-950">Go to Lead Research Queue</Link></div> : null}

        {lead ? <div className="grid gap-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <button
                disabled={index === 0 || isPending}
                onClick={goPrev}
                className="h-10 rounded-xl border border-slate-200 px-3 text-xs font-black text-slate-700 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                disabled={index >= parsedLeads.length - 1 || isPending}
                onClick={goNext}
                className="h-10 rounded-xl border border-slate-200 px-3 text-xs font-black text-slate-700 disabled:opacity-50"
              >
                Next
              </button>
              <label className="ml-auto flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                Jump to
                <input
                  type="number"
                  min={1}
                  max={parsedLeads.length}
                  value={index + 1}
                  onChange={(event) => goTo(Number(event.target.value || 1) - 1)}
                  className="h-10 w-20 rounded-xl border border-slate-200 px-2 text-sm font-black text-slate-900"
                />
              </label>
            </div>
          </div>
          <div className="rounded-[2rem] bg-slate-950 p-6 text-white shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-lime-300">Lead {index + 1} of {parsedLeads.length}</p>
                <h2 className="mt-2 text-4xl font-black">{lead.businessName}</h2>
                <p className="mt-3 text-white/60">{lead.ownerName ? `${lead.ownerName} • ` : ""}{lead.category || "Local business"} • {lead.location || "Bay Area"} • Score {lead.score}</p>
                <p className="mt-3 flex flex-wrap gap-2 text-xs font-black uppercase tracking-[0.14em]"><span className="rounded-full bg-white/10 px-3 py-1 text-white/70">Views {lead.viewCount}</span><span className="rounded-full bg-white/10 px-3 py-1 text-white/70">Payment clicks {lead.paymentClickCount}</span>{lead.lastPaymentClickedAt ? <span className="rounded-full bg-rose-500 px-3 py-1 text-white">Clicked payment {new Date(lead.lastPaymentClickedAt).toLocaleDateString()}</span> : null}{!lead.lastPaymentClickedAt && lead.lastViewedAt ? <span className="rounded-full bg-lime-300 px-3 py-1 text-slate-950">Viewed {new Date(lead.lastViewedAt).toLocaleDateString()}</span> : null}</p>
                <p className="mt-4 max-w-3xl text-sm leading-6 text-white/70">
                  {getPrimaryPainPoints(lead)[0] || lead.painSummary}
                </p>
                {getOutreachAngles(lead).length > 0 ? (
                  <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-lime-300">
                    Angle: {getOutreachAngles(lead)[0]}
                  </p>
                ) : null}
              </div>
              <div className="rounded-3xl bg-lime-300 px-6 py-5 text-center text-slate-950"><p className="text-4xl font-black">{lead.score}</p><p className="text-xs font-black uppercase tracking-[0.18em]">Lead score</p></div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <a href={lead.phone ? `tel:${lead.phone}` : undefined} className={`rounded-3xl border border-slate-200 bg-white p-5 shadow-sm ${lead.phone ? "hover:bg-lime-50" : "opacity-50"}`}><Phone className="size-6 text-lime-700" /><p className="mt-3 text-xs font-black uppercase tracking-[0.16em] text-slate-400">Phone</p><p className="mt-1 font-black">{lead.phone || "Missing"}</p></a>
            <a href={smsUrl || undefined} className={`rounded-3xl border border-slate-200 bg-white p-5 shadow-sm ${smsUrl ? "hover:bg-lime-50" : "opacity-50"}`}><MessageSquareText className="size-6 text-lime-700" /><p className="mt-3 text-xs font-black uppercase tracking-[0.16em] text-slate-400">SMS</p><p className="mt-1 font-black">Open draft</p></a>
            <a href={lead.websiteUrl ?? auditUrl} target="_blank" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm hover:bg-lime-50"><ExternalLink className="size-6 text-lime-700" /><p className="mt-3 text-xs font-black uppercase tracking-[0.16em] text-slate-400">Website/Audit</p><p className="mt-1 truncate font-black">{lead.websiteUrl || "Public audit"}</p></a>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"><h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Cold call script</h3><p className="mt-4 whitespace-pre-line text-lg font-semibold leading-8 text-slate-800">{lead.assets.coldCallScript}</p></div>
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"><h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">SMS script</h3><p className="mt-4 whitespace-pre-line text-lg font-semibold leading-8 text-slate-800">{lead.assets.textMessageScript}</p></div>
          </div>

          <div className="grid gap-3 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-4">
            <button disabled={isPending} onClick={() => logAndNext("Call", "Called from Outreach Focus Mode. Follow up in 3 days.")} className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-lime-300 px-4 text-sm font-black text-slate-950 transition hover:bg-lime-200 disabled:opacity-60">{isPending ? <Loader2 className="size-4 animate-spin" /> : <Phone className="size-4" />} Log Call & Next</button>
            <button disabled={isPending} onClick={() => logAndNext("SMS", "Sent SMS from Outreach Focus Mode. Follow up in 3 days.")} className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-sky-500 px-4 text-sm font-black text-white transition hover:bg-sky-400 disabled:opacity-60"><MessageSquareText className="size-4" /> Log SMS & Next</button>
            <a href={emailUrl} onClick={() => logAndNext("Email", "Opened email draft from Outreach Focus Mode. Follow up in 3 days.")} className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"><Mail className="size-4" /> Email Draft</a>
            <button disabled={isPending} onClick={skipAndNext} className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"><SkipForward className="size-4" /> Skip</button>
          </div>
          {error ? <p className="rounded-2xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p> : null}
        </div> : null}
      </section>
    </main>
  );
}
