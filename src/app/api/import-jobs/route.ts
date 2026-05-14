import { NextResponse } from "next/server";
import { listRecentImportJobs, processImportJobChunk, serializeImportJob } from "@/lib/import-jobs";
import { getWorkspaceContext } from "@/lib/workspace";

export async function GET() {
  const { workspaceId } = await getWorkspaceContext();
  const jobs = await listRecentImportJobs(12, workspaceId);
  return NextResponse.json({ ok: true, jobs: jobs.map(serializeImportJob) });
}

export async function POST() {
  const { workspaceId } = await getWorkspaceContext();
  const jobs = await listRecentImportJobs(1, workspaceId);
  const nextQueued = jobs.find((job) => ["Queued", "Running"].includes(job.status));
  if (!nextQueued) return NextResponse.json({ ok: true, processed: false });
  const updated = await processImportJobChunk(nextQueued.id, undefined, workspaceId);
  if (!updated) return NextResponse.json({ ok: false, error: "Job not found." }, { status: 404 });
  return NextResponse.json({ ok: true, processed: true, job: serializeImportJob(updated) });
}
