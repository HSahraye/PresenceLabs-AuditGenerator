import { NextResponse } from "next/server";
import { processLeadSequences } from "@/lib/automation/outreach/sequences";
import { processOutboundQueue } from "@/lib/automation/outreach";
import { runAutomationMonitors } from "@/lib/automation/workflows/monitors";
import { getEnv } from "@/lib/env";
import { enforceRateLimit } from "@/lib/request-security";

export async function POST(request: Request) {
  const limited = await enforceRateLimit("automation-process", 30, 60_000);
  if (limited) return limited;
  const env = getEnv();
  if (env.AUTOMATION_RUNNER_SECRET) {
    const token = request.headers.get("x-automation-secret");
    if (token !== env.AUTOMATION_RUNNER_SECRET) {
      return NextResponse.json({ ok: false, error: "Unauthorized automation runner." }, { status: 401 });
    }
  }
  await processLeadSequences({ limit: 100 });
  await processOutboundQueue({ limit: 100 });
  await runAutomationMonitors({ limit: 300 });
  return NextResponse.json({ ok: true });
}
