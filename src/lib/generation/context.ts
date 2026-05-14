import { prisma } from "@/lib/prisma";
import { resolveTemplate } from "@/lib/templates";

export async function resolveGenerationContext(workspaceId?: string, category?: string | null) {
  if (!workspaceId) {
    const auditTemplate = await resolveTemplate("system", "audit", category);
    const outreachTemplate = await resolveTemplate("system", "outreach", category);
    const offerTemplate = await resolveTemplate("system", "offer", category);
    return {
      workspace: null,
      workspaceSettings: null,
      auditTemplate,
      outreachTemplate,
      offerTemplate,
    };
  }

  const [workspace, workspaceSettings, auditTemplate, outreachTemplate, offerTemplate] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        customDomain: true,
        auditSubdomain: true,
      },
    }),
    prisma.workspaceSettings.findUnique({
      where: { workspaceId },
    }),
    resolveTemplate(workspaceId, "audit", category),
    resolveTemplate(workspaceId, "outreach", category),
    resolveTemplate(workspaceId, "offer", category),
  ]);

  return {
    workspace,
    workspaceSettings,
    auditTemplate,
    outreachTemplate,
    offerTemplate,
  };
}
