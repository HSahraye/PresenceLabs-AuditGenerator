import crypto from "node:crypto";
import { getEnv } from "./env";
import { logger } from "./logger";

function signBody(body: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

export async function sendCrmWebhook(eventType: string, payload: Record<string, unknown>) {
  const env = getEnv();
  if (!env.CRM_WEBHOOK_URL) return;

  const body = JSON.stringify({
    eventType,
    ts: new Date().toISOString(),
    payload,
  });
  const signature = env.CRM_WEBHOOK_SECRET ? signBody(body, env.CRM_WEBHOOK_SECRET) : "";

  try {
    const response = await fetch(env.CRM_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(signature ? { "x-presencelabs-signature": signature } : {}),
      },
      body,
    });
    if (!response.ok) {
      logger.warn("crm_webhook_failed", { eventType, status: response.status });
    }
  } catch (error) {
    logger.warn("crm_webhook_error", { eventType, error: error instanceof Error ? error.message : "unknown" });
  }
}
