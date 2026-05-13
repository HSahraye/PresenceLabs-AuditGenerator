import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({ leadId: z.string().min(1) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const headerStore = await headers();
  const userAgent = headerStore.get("user-agent") ?? null;
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headerStore.get("x-real-ip") ?? null;

  await prisma.paymentLog.create({
    data: { leadId: parsed.data.leadId, ip, userAgent },
  });

  return NextResponse.json({ ok: true });
}
