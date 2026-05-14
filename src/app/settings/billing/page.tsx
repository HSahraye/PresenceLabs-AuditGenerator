import Link from "next/link";
import { PLAN_LIMITS } from "@/lib/billing/plans";
import { getWorkspaceUsage } from "@/lib/billing/usage";
import { getCurrentSession } from "@/lib/auth";
import { getOnboardingProgress } from "@/lib/onboarding";
import { prisma } from "@/lib/prisma";
import { BillingSettings } from "@/components/billing-settings";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.role !== "owner") redirect("/");

  const workspace = await prisma.workspace.findUnique({
    where: { id: session.workspaceId },
    select: {
      id: true,
      name: true,
      planTier: true,
      status: true,
      trialEndsAt: true,
    },
  });
  if (!workspace) redirect("/");

  const usage = await getWorkspaceUsage(workspace.id);
  const onboarding = await getOnboardingProgress(workspace.id);
  const limits = PLAN_LIMITS[workspace.planTier];
  const canManage = true;

  return (
    <main className="min-h-screen bg-[#f5f7f2] px-4 py-8 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-lime-700">SaaS Billing</p>
            <h1 className="mt-1 text-2xl font-black">Billing & Usage</h1>
          </div>
          <Link href="/" className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 hover:bg-slate-50">
            Back to Dashboard
          </Link>
        </div>
        <BillingSettings
          workspaceName={workspace.name}
          planTier={workspace.planTier}
          status={workspace.status}
          trialEndsAt={workspace.trialEndsAt?.toISOString() ?? null}
          usage={usage}
          limits={limits}
          canManage={canManage}
        />
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Activation Progress</p>
          <p className="mt-2 text-sm text-slate-700">
            {onboarding.completed}/{onboarding.total} milestones complete
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {onboarding.items.map((item) => (
              <div key={item.key} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-xs font-black uppercase tracking-[0.1em] text-slate-500">{item.key.replaceAll("_", " ")}</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {item.completedAt ? `Completed ${new Date(item.completedAt).toLocaleDateString()}` : "Pending"}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
