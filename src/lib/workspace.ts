import { prisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";
import { cookies } from "next/headers";

const DEFAULT_WORKSPACE_SLUG_FALLBACK = "default";
const DEFAULT_WORKSPACE_NAME_FALLBACK = "Default Workspace";

export type WorkspaceContext = {
  workspaceId: string;
  workspaceSlug: string;
};

export async function ensureDefaultWorkspace() {
  const env = getEnv();
  const slug = env.DEFAULT_WORKSPACE_SLUG?.trim() || DEFAULT_WORKSPACE_SLUG_FALLBACK;
  const name = env.DEFAULT_WORKSPACE_NAME?.trim() || DEFAULT_WORKSPACE_NAME_FALLBACK;
  return prisma.workspace.upsert({
    where: { slug },
    update: { name },
    create: { slug, name },
  });
}

export async function getWorkspaceContext(): Promise<WorkspaceContext> {
  const workspace = await ensureDefaultWorkspace();
  return { workspaceId: workspace.id, workspaceSlug: workspace.slug };
}

export async function listWorkspacesForUser(userId: string) {
  const defaultWorkspace = await ensureDefaultWorkspace();
  const elevatedMembership = await prisma.membership.findFirst({
    where: {
      userId,
      role: { in: ["owner", "admin"] },
    },
    select: { role: true },
  });
  await prisma.membership.upsert({
    where: {
      userId_workspaceId: {
        userId,
        workspaceId: defaultWorkspace.id,
      },
    },
    update: {
      role: elevatedMembership?.role ?? "member",
    },
    create: {
      userId,
      workspaceId: defaultWorkspace.id,
      role: elevatedMembership?.role ?? "member",
    },
  });

  const memberships = await prisma.membership.findMany({
    where: { userId },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });
  return memberships.map((membership) => ({
    workspaceId: membership.workspaceId,
    workspaceSlug: membership.workspace.slug,
    workspaceName: membership.workspace.name,
    role: membership.role,
  }));
}

export async function getWorkspaceContextForUser(userId: string): Promise<WorkspaceContext> {
  const workspaceCookie = (await cookies()).get("pl_workspace")?.value;
  const memberships = await listWorkspacesForUser(userId);
  const selected = memberships.find((item) => item.workspaceId === workspaceCookie) ?? memberships[0];
  if (selected) {
    return {
      workspaceId: selected.workspaceId,
      workspaceSlug: selected.workspaceSlug,
    };
  }
  return getWorkspaceContext();
}

export function withWorkspaceFallbackScope(workspaceId: string) {
  return {
    OR: [{ workspaceId }, { workspaceId: null }],
  };
}
