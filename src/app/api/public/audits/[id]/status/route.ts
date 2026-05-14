import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWorkspaceContext, withWorkspaceFallbackScope } from "@/lib/workspace";

type Params = { params: Promise<{ id: string }> };

function corsHeaders(origin: string | null) {
  return {
    "access-control-allow-origin": origin ?? "https://presencelabs.net",
    "access-control-allow-methods": "GET,OPTIONS",
    "access-control-allow-headers": "content-type",
  };
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request.headers.get("origin")) });
}

export async function GET(request: Request, { params }: Params) {
  const origin = request.headers.get("origin");
  const { id } = await params;
  const { workspaceId } = await getWorkspaceContext();
  const job = await prisma.importJob.findFirst({ where: { id, ...withWorkspaceFallbackScope(workspaceId) } });
  if (!job) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404, headers: corsHeaders(origin) });
  return NextResponse.json(
    {
      ok: true,
      status: job.status,
      progress: {
        totalRows: job.totalRows,
        processedRows: job.processedRows,
        importedRows: job.importedRows,
        skippedRows: job.skippedRows,
        failedRows: job.failedRows,
      },
      completedAt: job.completedAt?.toISOString() ?? null,
      errorSummary: job.errorSummary ?? "",
    },
    { headers: corsHeaders(origin) },
  );
}
