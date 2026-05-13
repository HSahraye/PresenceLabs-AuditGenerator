"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowLeft, CheckCircle2, Clock, Loader2, Mail, Phone, PhoneCall, PhoneOff, Voicemail } from "lucide-react";
import { logOutreachAction } from "@/app/actions/leads";
import { formatMoney } from "@/lib/money";
import { formatRelativeTime } from "@/lib/utils";

type LeadRow = {
  id: string;
  businessName: string;
  ownerName: string | null;
  category: string | null;
  location: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  status: string;
  score: number;
  packageName: string;
  customPrice: number | null;
  painSummary: string;
  assetsJson: string;
  nextFollowUpAt: string | null;
  lastContactedAt: string | null;
};

type QuickAction = {
  label: string;
  type: "Call" | "SMS" | "Email" | "Note";
  icon: React.ReactNode;
  color: string;
  note: string;
};

const quickActions: QuickAction[] = [
  { label: "Called", type: "Call", icon: <PhoneCall className="size-4" />, color: "bg-lime-300 text-slate-950 hover:bg-lime-200", note: "Called lead." },
  { label: "Left VM", type: "Call", icon: <Voicemail className="size-4" />, color: "bg-yellow-200 text-slate-950 hover:bg-yellow-100", note: "Left voicemail." },
  { label: "No Answer", type: "Call", icon: <PhoneOff className="size-4" />, color: "bg-slate-100 text-slate-700 hover:bg-slate-200", note: "No answer." },
  { label: "Booked!", type: "Note", icon: <CheckCircle2 className="size-4" />, color: "bg-emerald-400 text-white hover:bg-emerald-300", note: "Booked a meeting / demo." },
];

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, (score / 10) * 100);
  const color = score >= 8 ? "bg-emerald-400" : score >= 5 ? "bg-lime-300" : "bg-yellow-300";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-black text-slate-700">{score}/10</span>
    </div>
  );
}

export function CallTodayDashboard({ leads }: { leads: LeadRow[] }) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [nextFollowUp, setNextFollowUp] = useState<Record<string, string>>({});
  const [, startTransition] = useTransition();

  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(new Date().getTime() + 86_400_000).toISOString().slice(0, 10);

  const remaining = leads.filter((l) => !done.has(l.id));
  const completedCount = done.size;

  const logQuick = (lead: LeadRow, action: QuickAction) => {
    if (pendingId) return;
    setPendingId(lead.id);
    const nfu = nextFollowUp[lead.id] || tomorrow;
    startTransition(async () => {
      await logOutreachAction(lead.id, action.type, action.note, action.type !== "Note" ? nfu : undefined);
      setDone((prev) => new Set([...prev, lead.id]));
      setPendingId(null);
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      {/* Header */}
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50">
              <ArrowLeft className="size-3.5" /> Dashboard
            </Link>
            <div>
              <h1 className="text-xl font-black text-slate-950">📞 Call Today</h1>
              <p className="text-xs text-slate-500">{remaining.length} to call · {completedCount} done</p>
            </div>
          </div>
          <div className="rounded-2xl bg-lime-300 px-3 py-1.5 text-xs font-black text-slate-950">
            {completedCount}/{leads.length} done
          </div>
        </div>

        {/* Progress bar */}
        {leads.length > 0 && (
          <div className="mb-6 h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-lime-400 transition-all duration-500"
              style={{ width: `${leads.length > 0 ? (completedCount / leads.length) * 100 : 0}%` }}
            />
          </div>
        )}

        {/* Empty state */}
        {leads.length === 0 && (
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <p className="text-4xl">🎉</p>
            <p className="mt-3 text-lg font-black text-slate-950">No calls due today!</p>
            <p className="mt-1 text-sm text-slate-500">Set follow-up dates on leads to populate this list.</p>
            <Link href="/" className="mt-4 inline-flex h-10 items-center gap-2 rounded-2xl bg-slate-950 px-4 text-xs font-black text-white transition hover:bg-slate-800">
              Back to Dashboard
            </Link>
          </div>
        )}

        {remaining.length === 0 && leads.length > 0 && (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-10 text-center shadow-sm">
            <p className="text-4xl">🏆</p>
            <p className="mt-3 text-lg font-black text-emerald-900">All done for today!</p>
            <p className="mt-1 text-sm text-emerald-700">You contacted {completedCount} lead{completedCount !== 1 ? "s" : ""}. Nice work.</p>
            <Link href="/" className="mt-4 inline-flex h-10 items-center gap-2 rounded-2xl bg-slate-950 px-4 text-xs font-black text-white transition hover:bg-slate-800">
              Back to Dashboard
            </Link>
          </div>
        )}

        {/* Lead cards */}
        <div className="grid gap-4">
          {remaining.map((lead) => {
            const assets = (() => {
              try { return JSON.parse(lead.assetsJson); } catch { return {}; }
            })();
            const isPending = pendingId === lead.id;
            const price = lead.customPrice ?? assets.recommendedInvestment ?? null;
            const callScript: string | undefined = assets.callScript ?? assets.coldCallScript;

            return (
              <div key={lead.id} className={`rounded-3xl border bg-white shadow-sm transition-all ${lead.score >= 8 ? "border-lime-300" : "border-slate-200"}`}>
                {/* HOT badge */}
                {lead.score >= 8 && (
                  <div className="flex items-center gap-1 rounded-t-3xl bg-lime-300 px-4 py-1.5">
                    <span className="text-xs font-black text-slate-950">🔥 HOT LEAD</span>
                  </div>
                )}
                {lead.score < 8 && lead.lastContactedAt && (new Date().getTime() - new Date(lead.lastContactedAt).getTime() >= 3 * 24 * 60 * 60 * 1000) && (
                  <div className="flex items-center gap-1 rounded-t-3xl bg-orange-200 px-4 py-1.5">
                    <span className="text-xs font-black text-orange-800">👻 GHOST — RE-ENGAGE</span>
                  </div>
                )}
                <div className="p-5">
                  {/* Business info */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-black text-slate-950">{lead.businessName}</p>
                      {lead.ownerName && <p className="text-xs text-slate-500">Owner: {lead.ownerName}</p>}
                      <p className="mt-0.5 text-xs text-slate-400">{[lead.category, lead.location].filter(Boolean).join(" · ")}</p>
                    </div>
                    <div className="text-right">
                      <ScoreBar score={lead.score} />
                      {price && <p className="mt-1 text-xs font-black text-slate-700">{formatMoney(price)}</p>}
                    </div>
                  </div>

                  {/* Pain summary */}
                  <p className="mt-3 text-sm text-slate-600 leading-relaxed">{lead.painSummary}</p>

                  {/* Package */}
                  <div className="mt-2 inline-flex rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{lead.packageName}</div>

                  {/* Call script snippet */}
                  {callScript && (
                    <div className="mt-3 rounded-2xl bg-slate-50 p-3">
                      <p className="text-xs font-black uppercase tracking-wide text-slate-400 mb-1">Call Script</p>
                      <p className="text-xs text-slate-700 leading-relaxed line-clamp-4">{callScript}</p>
                    </div>
                  )}

                  {/* Contact actions */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {lead.phone && (
                      <a
                        href={`tel:${lead.phone}`}
                        className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-950 px-4 text-xs font-black text-white transition hover:bg-slate-800"
                      >
                        <Phone className="size-4" /> {lead.phone}
                      </a>
                    )}
                    {lead.email && (
                      <a
                        href={`mailto:${lead.email}?subject=Quick question about your online presence`}
                        className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 px-4 text-xs font-black text-slate-700 transition hover:bg-slate-50"
                      >
                        <Mail className="size-4" /> Email
                      </a>
                    )}
                    <Link
                      href={`/audit/${lead.id}`}
                      target="_blank"
                      className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 px-4 text-xs font-black text-slate-700 transition hover:bg-slate-50"
                    >
                      View Audit ↗
                    </Link>
                  </div>

                  {/* Next follow-up + quick log */}
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <div className="flex flex-wrap items-end gap-3">
                      <div>
                        <label className="text-xs font-black text-slate-500 uppercase tracking-wide">Next Follow-up</label>
                        <input
                          type="date"
                          value={nextFollowUp[lead.id] ?? tomorrow}
                          min={today}
                          onChange={(e) => setNextFollowUp((prev) => ({ ...prev, [lead.id]: e.target.value }))}
                          className="mt-1 block h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold outline-none focus:border-lime-400"
                        />
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-500 uppercase tracking-wide mb-1">Log Outcome</p>
                        <div className="flex flex-wrap gap-2">
                          {quickActions.map((action) => (
                            <button
                              key={action.label}
                              disabled={isPending}
                              onClick={() => logQuick(lead, action)}
                              className={`inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-black transition disabled:opacity-50 ${action.color}`}
                            >
                              {isPending ? <Loader2 className="size-3.5 animate-spin" /> : action.icon}
                              {action.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    {lead.lastContactedAt && (
                      <p className="mt-2 text-xs text-slate-400">
                        <Clock className="inline size-3 mr-0.5" /> Last contacted {formatRelativeTime(new Date(lead.lastContactedAt))}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
