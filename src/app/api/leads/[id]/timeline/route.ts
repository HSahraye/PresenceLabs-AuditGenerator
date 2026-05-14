import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { getLeadTimeline } from "@/lib/automation/timeline";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  const { id } = await context.params;
  const timeline = await getLeadTimeline(session.workspaceId, id);
  return NextResponse.json({
    ok: true,
    timeline: timeline.map((item) => ({
      type: item.type,
      detail: item.detail,
      source: item.source,
      createdAt: item.createdAt.toISOString(),
    })),
  });
}
