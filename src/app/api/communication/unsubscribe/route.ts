import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  workspaceId: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = schema.safeParse({
    workspaceId: url.searchParams.get("workspaceId"),
    email: url.searchParams.get("email") || undefined,
    phone: url.searchParams.get("phone") || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid unsubscribe request." }, { status: 400 });
  }
  if (!parsed.data.email && !parsed.data.phone) {
    return NextResponse.json({ ok: false, error: "Email or phone is required." }, { status: 400 });
  }
  if (parsed.data.email) {
    await prisma.unsubscribedContact.upsert({
      where: {
        workspaceId_email: {
          workspaceId: parsed.data.workspaceId,
          email: parsed.data.email,
        },
      },
      update: {
        phone: parsed.data.phone ?? null,
        reason: "user_unsubscribe",
      },
      create: {
        workspaceId: parsed.data.workspaceId,
        email: parsed.data.email,
        phone: parsed.data.phone ?? null,
        reason: "user_unsubscribe",
      },
    });
  } else if (parsed.data.phone) {
    await prisma.unsubscribedContact.upsert({
      where: {
        workspaceId_phone: {
          workspaceId: parsed.data.workspaceId,
          phone: parsed.data.phone,
        },
      },
      update: {
        reason: "user_unsubscribe",
      },
      create: {
        workspaceId: parsed.data.workspaceId,
        phone: parsed.data.phone,
        reason: "user_unsubscribe",
      },
    });
  }
  return NextResponse.json({ ok: true, message: "You have been unsubscribed." });
}
