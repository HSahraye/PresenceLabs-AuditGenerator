import { NextResponse } from "next/server";
import { listRecentImportJobs, processImportJobChunk, serializeImportJob } from "@/lib/import-jobs";

export async function GET() {
  const jobs = await listRecentImportJobs(12);
  return NextResponse.json({ ok: true, jobs: jobs.map(serializeImportJob) });
}

export async function POST() {
  const jobs = await listRecentImportJobs(1);
  const nextQueued = jobs.find((job) => ["Queued", "Running"].includes(job.status));
  if (!nextQueued) return NextResponse.json({ ok: true, processed: false });
  const updated = await processImportJobChunk(nextQueued.id);
  if (!updated) return NextResponse.json({ ok: false, error: "Job not found." }, { status: 404 });
  return NextResponse.json({ ok: true, processed: true, job: serializeImportJob(updated) });
}
