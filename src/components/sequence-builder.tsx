"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { saveSequenceBuilderAction, setSequenceStatusAction } from "@/app/actions/automation";
import { defaultStepContent, defaultStepName, defaultStepSubject, type SequenceStepChannel } from "@/lib/automation/outreach/defaults";

type StepView = {
  id: string;
  stepOrder: number;
  name: string;
  channel: "email" | "sms" | "task" | "call";
  delayMinutes: number;
  contentTemplate: string;
  approvalRequired: boolean;
  subject: string;
  metadataJson: string;
};

type LeadStateView = {
  id: string;
  leadName: string;
  status: string;
  currentStep: number;
  nextRunAt: string | null;
  lastError: string | null;
  retries: number;
  lastExecutedAction: string | null;
};

const PERSONALIZATION_VARIABLES = [
  { label: "Business name", token: "{{businessName}}" },
  { label: "Owner name", token: "{{ownerName}}" },
  { label: "City", token: "{{city}}" },
  { label: "Category", token: "{{category}}" },
  { label: "Pain point", token: "{{painPoint}}" },
  { label: "Recommended offer", token: "{{recommendedOffer}}" },
];

export function SequenceBuilder({
  sequence,
  steps,
  leadStates,
}: {
  sequence: { id: string; name: string; category: string | null; status: "active" | "paused" | "archived"; autoMode: "auto_draft" | "approval_required" | "auto_send" };
  steps: StepView[];
  leadStates: LeadStateView[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(sequence.name);
  const [category, setCategory] = useState(sequence.category || "");
  const [status, setStatus] = useState(sequence.status);
  const [autoMode, setAutoMode] = useState(sequence.autoMode);
  const [stepState, setStepState] = useState<StepView[]>(steps);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const sorted = useMemo(() => [...stepState].sort((a, b) => a.stepOrder - b.stepOrder), [stepState]);

  const replaceStep = (idx: number, next: Partial<StepView>) => {
    setStepState((current) => current.map((step, index) => (index === idx ? { ...step, ...next } : step)));
  };

  const applyChannelDefaults = (idx: number, nextChannel: SequenceStepChannel) => {
    setStepState((current) =>
      current.map((step, index) => {
        if (index !== idx) return step;
        const wasDefaultBody = step.contentTemplate.trim() === defaultStepContent(step.channel).trim();
        const wasDefaultSubject = step.subject.trim() === defaultStepSubject(step.channel).trim();
        return {
          ...step,
          channel: nextChannel,
          name: step.name.trim() ? step.name : defaultStepName(nextChannel, idx),
          subject: nextChannel === "email" ? (wasDefaultSubject || !step.subject.trim() ? defaultStepSubject(nextChannel) : step.subject) : "",
          contentTemplate: wasDefaultBody || !step.contentTemplate.trim() ? defaultStepContent(nextChannel) : step.contentTemplate,
        };
      }),
    );
  };

  const addStep = () => {
    const channel: SequenceStepChannel = "email";
    setStepState((current) => [
      ...current,
      {
        id: `local-${Date.now()}`,
        stepOrder: current.length,
        name: defaultStepName(channel, current.length),
        channel,
        delayMinutes: 0,
        contentTemplate: defaultStepContent(channel),
        approvalRequired: true,
        subject: defaultStepSubject(channel),
        metadataJson: "{}",
      },
    ]);
  };

  const removeStep = (indexToRemove: number) => {
    setStepState((current) =>
      current
        .filter((_step, index) => index !== indexToRemove)
        .map((step, index) => ({
          ...step,
          stepOrder: index,
        })),
    );
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= sorted.length) return;
    const next = [...sorted];
    const temp = next[index];
    next[index] = next[target];
    next[target] = temp;
    setStepState(
      next.map((step, idx) => ({
        ...step,
        stepOrder: idx,
      })),
    );
  };

  const save = () => {
    startTransition(async () => {
      setError("");
      setSuccess("");
      const formData = new FormData();
      formData.set("sequenceId", sequence.id);
      formData.set("name", name);
      formData.set("category", category);
      formData.set("status", status);
      formData.set("autoMode", autoMode);
      formData.set(
        "stepsJson",
        JSON.stringify(
          sorted.map((step) => ({
            id: step.id.startsWith("local-") ? undefined : step.id,
            name: step.name,
            channel: step.channel,
            delayMinutes: step.delayMinutes,
            contentTemplate: step.contentTemplate,
            approvalRequired: step.approvalRequired,
            subject: step.subject,
            metadata: (() => {
              try {
                return JSON.parse(step.metadataJson || "{}");
              } catch {
                return null;
              }
            })(),
          })),
        ),
      );
      const result = await saveSequenceBuilderAction(formData);
      if (!result.ok) {
        setError(result.error || "Could not save sequence.");
        return;
      }
      setSuccess("Sequence saved.");
      router.refresh();
    });
  };

  const quickStatus = (nextStatus: "active" | "paused" | "archived") => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("sequenceId", sequence.id);
      formData.set("status", nextStatus);
      await setSequenceStatusAction(formData);
      setStatus(nextStatus);
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black">Sequence Builder</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm font-bold text-slate-700">
            Name
            <input value={name} onChange={(event) => setName(event.target.value)} className="h-11 rounded-2xl border border-slate-200 px-3 outline-none focus:border-lime-400" />
          </label>
          <label className="grid gap-1 text-sm font-bold text-slate-700">
            Category
            <input value={category} onChange={(event) => setCategory(event.target.value)} className="h-11 rounded-2xl border border-slate-200 px-3 outline-none focus:border-lime-400" />
          </label>
          <label className="grid gap-1 text-sm font-bold text-slate-700">
            Status
            <select value={status} onChange={(event) => setStatus(event.target.value as "active" | "paused" | "archived")} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 outline-none focus:border-lime-400">
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-bold text-slate-700">
            Auto mode
            <select value={autoMode} onChange={(event) => setAutoMode(event.target.value as "auto_draft" | "approval_required" | "auto_send")} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 outline-none focus:border-lime-400">
              <option value="auto_draft">Auto Draft</option>
              <option value="approval_required">Approval Required</option>
              <option value="auto_send">Auto Send</option>
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button disabled={isPending} onClick={save} className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white hover:bg-slate-800 disabled:opacity-60">
            {isPending ? "Saving..." : "Save Sequence"}
          </button>
          <button disabled={isPending} onClick={() => quickStatus("active")} className="rounded-xl border border-lime-200 bg-lime-50 px-3 py-2 text-xs font-black text-lime-800 hover:bg-lime-100">
            Activate
          </button>
          <button disabled={isPending} onClick={() => quickStatus("paused")} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-800 hover:bg-amber-100">
            Pause
          </button>
          <button disabled={isPending} onClick={() => quickStatus("archived")} className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-200">
            Archive
          </button>
        </div>
        {error ? <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p> : null}
        {success ? <p className="mt-3 rounded-xl bg-lime-50 p-3 text-sm font-bold text-lime-800">{success}</p> : null}
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-black">Steps</h3>
          <button onClick={addStep} className="rounded-xl bg-lime-300 px-3 py-2 text-xs font-black text-slate-950 hover:bg-lime-200">
            Add Step
          </button>
        </div>
        <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50">
          <summary className="cursor-pointer px-3 py-2 text-sm font-black text-slate-700">Personalization variables</summary>
          <div className="grid gap-2 border-t border-slate-200 p-3 sm:grid-cols-2">
            {PERSONALIZATION_VARIABLES.map((item) => (
              <button
                key={item.token}
                type="button"
                onClick={() => navigator.clipboard.writeText(item.token)}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                <span>{item.label}</span>
                <code className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-800">{item.token}</code>
              </button>
            ))}
          </div>
        </details>
        <div className="mt-4 grid gap-3">
          {!sorted.length ? <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">Add at least one step.</p> : null}
          {sorted.map((step, index) => (
            <div key={step.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-sm font-bold text-slate-700">
                  Step name
                  <input value={step.name} onChange={(event) => replaceStep(index, { name: event.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 outline-none focus:border-lime-400" />
                </label>
                <label className="grid gap-1 text-sm font-bold text-slate-700">
                  Channel
                  <select value={step.channel} onChange={(event) => applyChannelDefaults(index, event.target.value as SequenceStepChannel)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 outline-none focus:border-lime-400">
                    <option value="email">email</option>
                    <option value="sms">sms</option>
                    <option value="task">task</option>
                    <option value="call">call</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-bold text-slate-700">
                  Delay Minutes
                  <input type="number" min={0} value={step.delayMinutes} onChange={(event) => replaceStep(index, { delayMinutes: Number(event.target.value || 0) })} className="h-10 rounded-xl border border-slate-200 px-3 outline-none focus:border-lime-400" />
                </label>
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  <input type="checkbox" checked={step.approvalRequired} onChange={(event) => replaceStep(index, { approvalRequired: event.target.checked })} />
                  Approval required
                </label>
              </div>
              {step.channel === "email" ? (
                <label className="mt-3 grid gap-1 text-sm font-bold text-slate-700">
                  Subject
                  <input value={step.subject} onChange={(event) => replaceStep(index, { subject: event.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 outline-none focus:border-lime-400" />
                </label>
              ) : null}
              <label className="mt-3 grid gap-1 text-sm font-bold text-slate-700">
                Message Template
                <textarea value={step.contentTemplate} onChange={(event) => replaceStep(index, { contentTemplate: event.target.value })} rows={4} className="rounded-xl border border-slate-200 p-3 outline-none focus:border-lime-400" />
              </label>
              <details className="mt-3 rounded-xl border border-slate-200 bg-white">
                <summary className="cursor-pointer px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500">Advanced metadata JSON</summary>
                <textarea value={step.metadataJson} onChange={(event) => replaceStep(index, { metadataJson: event.target.value })} rows={4} className="w-full border-t border-slate-200 p-3 text-xs font-semibold outline-none focus:border-lime-400" />
              </details>
              <div className="mt-3 flex flex-wrap gap-2">
                <button disabled={index === 0} onClick={() => moveStep(index, -1)} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700 disabled:opacity-50">
                  Move Up
                </button>
                <button disabled={index === sorted.length - 1} onClick={() => moveStep(index, 1)} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700 disabled:opacity-50">
                  Move Down
                </button>
                <button disabled={sorted.length <= 1} onClick={() => removeStep(index)} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-700 disabled:opacity-50">
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-black">Lead Progression</h3>
        <div className="mt-4 grid gap-2">
          {!leadStates.length ? <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">No enrolled leads yet.</p> : null}
          {leadStates.map((state) => (
            <div key={state.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-black">{state.leadName}</p>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                  {state.status} · step {state.currentStep + 1}
                </p>
              </div>
              <p className="mt-1 text-xs text-slate-600">
                Next action: {state.nextRunAt ? new Date(state.nextRunAt).toLocaleString() : "none"} · Last action: {state.lastExecutedAction || "n/a"} · Retries: {state.retries}
              </p>
              {state.lastError ? <p className="mt-1 text-xs font-bold text-rose-700">Failure: {state.lastError}</p> : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
