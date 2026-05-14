import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth";
import { markNotificationStatus } from "@/lib/automation/notifications";

const schema = z.object({
  status: z.enum(["read", "dismissed"]),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid status." }, { status: 400 });
  await markNotificationStatus({
    workspaceId: session.workspaceId,
    id,
    status: parsed.data.status,
  });
  return NextResponse.json({ ok: true });
}
