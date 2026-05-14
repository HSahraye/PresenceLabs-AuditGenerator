import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cancelImportJob, retryImportJob, serializeImportJob } from "@/lib/import-jobs";
import { getWorkspaceContext, withWorkspaceFallbackScope } from "@/lib/workspace";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false, error: "Missing job id." }, { status: 400 });
  const { workspaceId } = await getWorkspaceContext();

  const job = await prisma.importJob.findFirst({ where: { id, ...withWorkspaceFallbackScope(workspaceId) } });
  if (!job) return NextResponse.json({ ok: false, error: "Import job not found." }, { status: 404 });

  return NextResponse.json({ ok: true, job: serializeImportJob(job) });
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false, error: "Missing job id." }, { status: 400 });
  const { workspaceId } = await getWorkspaceContext();
  const body = (await request.json().catch(() => ({}))) as { action?: "retry" | "cancel" };
  if (body.action === "cancel") {
    const job = await cancelImportJob(id, workspaceId);
    if (!job) return NextResponse.json({ ok: false, error: "Import job not found." }, { status: 404 });
    return NextResponse.json({ ok: true, job: serializeImportJob(job) });
  }
  if (body.action === "retry") {
    const job = await retryImportJob(id, workspaceId);
    if (!job) return NextResponse.json({ ok: false, error: "Import job not found." }, { status: 404 });
    return NextResponse.json({ ok: true, job: serializeImportJob(job) });
  }
  return NextResponse.json({ ok: false, error: "Unsupported action." }, { status: 400 });
}
