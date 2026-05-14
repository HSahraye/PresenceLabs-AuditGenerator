import { getEnv } from "@/lib/env";

export type SmsSendInput = {
  workspaceId: string;
  to: string;
  body: string;
};

export type SmsSendResult = {
  ok: boolean;
  provider: string;
  providerMessageId?: string;
  error?: string;
};

export async function sendSms(input: SmsSendInput): Promise<SmsSendResult> {
  const env = getEnv();
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_FROM_PHONE) {
    return { ok: true, provider: "noop", providerMessageId: `noop-sms-${Date.now()}` };
  }
  const provider = "twilio";
  try {
    const credentials = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64");
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: "POST",
      headers: {
        authorization: `Basic ${credentials}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: input.to,
        From: env.TWILIO_FROM_PHONE,
        Body: input.body,
      }).toString(),
    });
    if (!response.ok) {
      return { ok: false, provider, error: `Twilio status ${response.status}` };
    }
    const payload = (await response.json()) as { sid?: string };
    return { ok: true, provider, providerMessageId: payload.sid };
  } catch (error) {
    return { ok: false, provider, error: error instanceof Error ? error.message : "SMS send failed." };
  }
}
