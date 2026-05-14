import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { listNotifications } from "@/lib/automation/notifications";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  const notifications = await listNotifications(session.workspaceId, session.userId ?? undefined);
  return NextResponse.json({
    ok: true,
    notifications: notifications.map((item) => ({
      id: item.id,
      title: item.title,
      body: item.body,
      status: item.status,
      channel: item.channel,
      createdAt: item.createdAt.toISOString(),
    })),
  });
}
