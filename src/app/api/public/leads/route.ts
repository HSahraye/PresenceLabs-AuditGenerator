import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";
import { enforceRateLimit, verifyHmacSignature } from "@/lib/request-security";
import { trackEvent } from "@/lib/events";
import { processImportJobChunk } from "@/lib/import-jobs";

const schema = z.object({
  businessName: z.string().min(1),
  ownerName: z.string().optional(),
  category: z.string().optional(),
  location: z.string().optional(),
  websiteUrl: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  notes: z.string().optional(),
  source: z.string().optional(),
});

function corsHeaders(origin: string | null) {
  return {
    "access-control-allow-origin": origin ?? "https://presencelabs.net",
    "access-control-allow-methods": "POST,OPTIONS",
    "access-control-allow-headers": "content-type,x-presencelabs-key,x-presencelabs-signature,x-presencelabs-ts",
  };
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(request: Request) {
  const limited = await enforceRateLimit("public-lead-ingest", 40, 60_000);
  if (limited) return limited;

  const env = getEnv();
  const origin = request.headers.get("origin");
  const key = request.headers.get("x-presencelabs-key") ?? "";
  const signature = request.headers.get("x-presencelabs-signature") ?? "";
  const timestamp = request.headers.get("x-presencelabs-ts") ?? "";
  const rawBody = await request.text();
  if (!env.PUBLIC_INGEST_API_KEY || !env.PUBLIC_INGEST_API_SECRET) {
    return NextResponse.json({ ok: false, error: "Public ingestion is not configured." }, { status: 503 });
  }
  if (!key || key !== env.PUBLIC_INGEST_API_KEY) {
    return NextResponse.json({ ok: false, error: "Invalid API key." }, { status: 401 });
  }
  const requestTs = Number(timestamp);
  if (!Number.isFinite(requestTs) || Math.abs(Date.now() - requestTs) > 5 * 60_000) {
    return NextResponse.json({ ok: false, error: "Expired request timestamp." }, { status: 401 });
  }
  const sigOk = verifyHmacSignature({
    rawBody: `${timestamp}.${rawBody}`,
    providedSignature: signature,
    secret: env.PUBLIC_INGEST_API_SECRET,
  });
  if (!sigOk) {
    return NextResponse.json({ ok: false, error: "Invalid request signature." }, { status: 401 });
  }

  const parsed = schema.safeParse(JSON.parse(rawBody));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid lead payload." }, { status: 400, headers: corsHeaders(origin) });
  }

  const importJob = await prisma.importJob.create({
    data: {
      status: "Queued",
      mode: "public-ingest",
      totalRows: 1,
      payloadJson: JSON.stringify([
        {
          "business name": parsed.data.businessName,
          owner: parsed.data.ownerName ?? "",
          "industry/category": parsed.data.category ?? "",
          city: parsed.data.location ?? "",
          website: parsed.data.websiteUrl ?? "",
          phone: parsed.data.phone ?? "",
          email: parsed.data.email ?? "",
          notes: parsed.data.notes ?? "",
          source: parsed.data.source ?? "presencelabs.net",
        },
      ]),
    },
  });
  void (async () => {
    for (let tick = 0; tick < 10; tick += 1) {
      const current = await processImportJobChunk(importJob.id);
      if (!current) break;
      if (["Completed", "Failed", "Cancelled"].includes(current.status)) break;
    }
  })();

  await trackEvent("public_lead_ingested", { importJobId: importJob.id, source: parsed.data.source ?? "presencelabs.net" });

  return NextResponse.json(
    {
      ok: true,
      importJobId: importJob.id,
      statusUrl: `/api/public/audits/${importJob.id}/status`,
    },
    { headers: corsHeaders(origin) },
  );
}
