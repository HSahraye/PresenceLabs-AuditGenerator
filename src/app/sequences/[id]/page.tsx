import Link from "next/link";
import { notFound } from "next/navigation";
import { requireWorkspaceRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SequenceBuilder } from "@/components/sequence-builder";

export const dynamic = "force-dynamic";

export default async function SequenceBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireWorkspaceRole(["owner", "admin", "member"]);
  const { id } = await params;
  const sequence = await prisma.sequence.findFirst({
    where: { id, workspaceId: session.workspaceId },
    include: {
      steps: { orderBy: { stepOrder: "asc" } },
      leadStates: {
        where: { workspaceId: session.workspaceId },
        orderBy: { updatedAt: "desc" },
        take: 30,
        include: {
          lead: { select: { businessName: true } },
          outboundMessages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { channel: true, status: true, retryCount: true, createdAt: true },
          },
        },
      },
    },
  });
  if (!sequence) notFound();

  const recentActivity = await prisma.activity.findMany({
    where: {
      workspaceId: session.workspaceId,
      OR: [
        { metadataJson: { contains: sequence.id } },
        { type: { startsWith: "sequence." } },
        { type: { startsWith: "automation." } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return (
    <main className="min-h-screen bg-[#f5f7f2] px-4 py-8 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-lime-700">Sequence</p>
            <h1 className="mt-1 text-2xl font-black">{sequence.name}</h1>
            <p className="text-sm text-slate-500">Edit steps, status, and automation behavior.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/automation/approvals" className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 hover:bg-slate-50">
              Approval Queue
            </Link>
            <Link href="/sequences" className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 hover:bg-slate-50">
              All Sequences
            </Link>
          </div>
        </div>

        <SequenceBuilder
          sequence={{
            id: sequence.id,
            name: sequence.name,
            category: sequence.category,
            status: sequence.status,
            autoMode: sequence.autoMode as "auto_draft" | "approval_required" | "auto_send",
          }}
          steps={sequence.steps.map((step) => {
            let subject = "";
            let metadataJson = "{}";
            try {
              if (step.conditionJson) {
                const parsed = JSON.parse(step.conditionJson) as { subject?: string; metadata?: Record<string, unknown> };
                subject = parsed.subject || "";
                metadataJson = JSON.stringify(parsed.metadata || {}, null, 2);
              }
            } catch {
              subject = "";
              metadataJson = "{}";
            }
            return {
              id: step.id,
              stepOrder: step.stepOrder,
              name: step.name,
              channel: step.channel,
              delayMinutes: step.delayMinutes,
              contentTemplate: step.contentTemplate || "",
              approvalRequired: step.approvalRequired,
              subject,
              metadataJson,
            };
          })}
          leadStates={sequence.leadStates.map((state) => ({
            id: state.id,
            leadName: state.lead.businessName,
            status: state.status,
            currentStep: state.currentStep,
            nextRunAt: state.nextRunAt?.toISOString() ?? null,
            lastError: state.lastError,
            retries: state.outboundMessages[0]?.retryCount ?? 0,
            lastExecutedAction: state.outboundMessages[0]
              ? `${state.outboundMessages[0].channel} (${state.outboundMessages[0].status})`
              : null,
          }))}
        />

        <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-black">Automation Activity Feed</h2>
          <div className="mt-4 grid gap-2">
            {!recentActivity.length ? <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">No recent automation events.</p> : null}
            {recentActivity.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{item.type}</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{item.detail || "No detail"}</p>
                <p className="mt-1 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
