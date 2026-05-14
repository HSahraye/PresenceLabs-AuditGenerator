"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useTransition } from "react";
import { createWorkspaceAction, inviteWorkspaceMemberAction, switchWorkspaceAction } from "@/app/actions/workspace";
import { buildClientPublicUrl } from "@/lib/public-url";

type WorkspaceItem = {
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
  role: string;
};

export function WorkspaceSwitcher({
  activeWorkspaceId,
  items,
  canManageWorkspace,
}: {
  activeWorkspaceId: string;
  items: WorkspaceItem[];
  canManageWorkspace: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [createError, setCreateError] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [copyInviteState, setCopyInviteState] = useState<"idle" | "copied" | "failed">("idle");

  const onSwitch = (workspaceId: string) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("workspaceId", workspaceId);
      await switchWorkspaceAction(formData);
      router.refresh();
    });
  };

  const onCreate = (formData: FormData) => {
    startTransition(async () => {
      setCreateError("");
      const result = await createWorkspaceAction(formData);
      if (!result.ok) {
        setCreateError(result.error || "Could not create workspace.");
        return;
      }
      router.refresh();
    });
  };

  const onInvite = (formData: FormData) => {
    startTransition(async () => {
      setInviteError("");
      setInviteLink("");
      setCopyInviteState("idle");
      const result = await inviteWorkspaceMemberAction(formData);
      if (!result.ok) {
        setInviteError(result.error || "Could not create invite.");
        return;
      }
      const inviteUrl = `${buildClientPublicUrl("/accept-invite")}?token=${encodeURIComponent(result.inviteToken || "")}`;
      setInviteLink(inviteUrl);
    });
  };

  const copyInviteLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopyInviteState("copied");
      window.setTimeout(() => {
        setCopyInviteState((current) => (current === "copied" ? "idle" : current));
      }, 1500);
    } catch {
      setCopyInviteState("failed");
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Workspace</p>
      <select
        disabled={isPending}
        value={activeWorkspaceId}
        onChange={(event) => onSwitch(event.target.value)}
        className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-black text-slate-700 outline-none focus:border-lime-400"
      >
        {items.map((workspace) => (
          <option key={workspace.workspaceId} value={workspace.workspaceId}>
            {workspace.workspaceName} ({workspace.role})
          </option>
        ))}
      </select>
      <form action={onCreate} className="mt-2 grid grid-cols-[1fr_auto] gap-2">
        <input
          name="name"
          placeholder="New workspace name"
          className="h-9 rounded-xl border border-slate-200 px-3 text-xs font-semibold outline-none focus:border-lime-400"
        />
        <button
          disabled={isPending}
          className="h-9 rounded-xl bg-slate-950 px-3 text-xs font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          Add
        </button>
      </form>
      {createError ? <p className="mt-2 text-xs font-bold text-rose-600">{createError}</p> : null}
      {canManageWorkspace ? (
        <form action={onInvite} className="mt-3 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Invite member</p>
          <input
            name="email"
            type="email"
            required
            placeholder="member@email.com"
            className="h-8 rounded-lg border border-slate-200 px-2 text-xs font-semibold outline-none focus:border-lime-400"
          />
          <select
            name="role"
            defaultValue="member"
            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold outline-none focus:border-lime-400"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <button
            disabled={isPending}
            className="h-8 rounded-lg bg-slate-950 px-2 text-xs font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            Generate invite link
          </button>
          {inviteError ? <p className="text-[11px] font-bold text-rose-600">{inviteError}</p> : null}
          {inviteLink ? (
            <button
              type="button"
              onClick={() => {
                void copyInviteLink();
              }}
              className="rounded-lg border border-lime-200 bg-lime-50 px-2 py-1 text-[11px] font-black text-lime-800"
            >
              {copyInviteState === "copied" ? "Copied" : "Copy invite link"}
            </button>
          ) : null}
          {copyInviteState === "copied" ? <p className="text-[11px] font-bold text-lime-700">Invite link copied.</p> : null}
          {copyInviteState === "failed" ? <p className="text-[11px] font-bold text-rose-700">Could not copy link. Select and copy manually.</p> : null}
        </form>
      ) : (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-2">
          <p className="text-[11px] font-bold text-slate-600">Only workspace admins can invite teammates.</p>
        </div>
      )}
      <Link
        href="/templates"
        className="mt-2 inline-flex h-8 items-center rounded-lg border border-slate-200 px-2 text-[11px] font-black uppercase tracking-[0.08em] text-slate-600 hover:bg-slate-50"
      >
        Manage templates
      </Link>
      <Link
        href="/settings/billing"
        className="mt-2 ml-2 inline-flex h-8 items-center rounded-lg border border-slate-200 px-2 text-[11px] font-black uppercase tracking-[0.08em] text-slate-600 hover:bg-slate-50"
      >
        Billing
      </Link>
      <Link
        href="/sequences"
        className="mt-2 ml-2 inline-flex h-8 items-center rounded-lg border border-slate-200 px-2 text-[11px] font-black uppercase tracking-[0.08em] text-slate-600 hover:bg-slate-50"
      >
        Sequences
      </Link>
    </div>
  );
}
