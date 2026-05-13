import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeImportJob } from "@/lib/import-jobs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false, error: "Missing job id." }, { status: 400 });

  const job = await prisma.importJob.findUnique({ where: { id } });
  if (!job) return NextResponse.json({ ok: false, error: "Import job not found." }, { status: 404 });

  return NextResponse.json({ ok: true, job: serializeImportJob(job) });
}
