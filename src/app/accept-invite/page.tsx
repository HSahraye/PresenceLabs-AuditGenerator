import { redirect } from "next/navigation";
import { acceptWorkspaceInviteAction } from "@/app/actions/workspace";

export const dynamic = "force-dynamic";

async function acceptInvite(formData: FormData) {
  "use server";
  const token = String(formData.get("token") ?? "");
  const result = await acceptWorkspaceInviteAction(token);
  if (!result.ok) {
    redirect(`/accept-invite?token=${encodeURIComponent(token)}&error=${encodeURIComponent(result.error || "Could not accept invitation.")}`);
  }
  redirect("/");
}

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const params = await searchParams;
  const token = params.token ?? "";
  const error = params.error ?? "";
  return (
    <main className="grid min-h-screen place-items-center bg-[#f5f7f2] p-6">
      <form action={acceptInvite} className="grid w-full max-w-lg gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-lime-700">Workspace Invitation</p>
        <h1 className="text-2xl font-black text-slate-950">Accept invite</h1>
        <p className="text-sm text-slate-500">
          Confirm invitation acceptance to join this workspace. You must be signed in with the invited email.
        </p>
        <input type="hidden" name="token" value={token} />
        <button
          disabled={!token}
          className="h-11 rounded-2xl bg-slate-950 text-sm font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          Accept invitation
        </button>
        {!token ? <p className="text-xs font-bold text-rose-600">Missing invitation token.</p> : null}
        {error ? <p className="text-xs font-bold text-rose-600">{error}</p> : null}
      </form>
    </main>
  );
}
