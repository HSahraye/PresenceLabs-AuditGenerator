import { getEnv } from "@/lib/env";

export type EmailSendInput = {
  workspaceId: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  unsubscribeUrl?: string;
};

export type EmailSendResult = {
  ok: boolean;
  provider: string;
  providerMessageId?: string;
  error?: string;
};

export async function sendEmail(input: EmailSendInput): Promise<EmailSendResult> {
  const env = getEnv();
  const provider = env.RESEND_API_KEY ? "resend" : env.POSTMARK_API_KEY ? "postmark" : "noop";
  if (provider === "noop") {
    return { ok: true, provider: "noop", providerMessageId: `noop-${Date.now()}` };
  }

  if (provider === "resend") {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: env.RESEND_FROM_EMAIL || "noreply@example.com",
          to: [input.to],
          subject: input.subject,
          html: `${input.html}${input.unsubscribeUrl ? `<br/><br/><a href="${input.unsubscribeUrl}">Unsubscribe</a>` : ""}`,
          text: input.text,
          tags: [{ name: "workspace_id", value: input.workspaceId }],
        }),
      });
      if (!response.ok) {
        return { ok: false, provider, error: `Resend status ${response.status}` };
      }
      const payload = (await response.json()) as { id?: string };
      return { ok: true, provider, providerMessageId: payload.id };
    } catch (error) {
      return { ok: false, provider, error: error instanceof Error ? error.message : "Email send failed." };
    }
  }

  try {
    const response = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Postmark-Server-Token": env.POSTMARK_API_KEY || "",
      },
      body: JSON.stringify({
        From: env.POSTMARK_FROM_EMAIL || "noreply@example.com",
        To: input.to,
        Subject: input.subject,
        HtmlBody: `${input.html}${input.unsubscribeUrl ? `<br/><br/><a href="${input.unsubscribeUrl}">Unsubscribe</a>` : ""}`,
        TextBody: input.text,
      }),
    });
    if (!response.ok) return { ok: false, provider, error: `Postmark status ${response.status}` };
    const payload = (await response.json()) as { MessageID?: string };
    return { ok: true, provider, providerMessageId: payload.MessageID };
  } catch (error) {
    return { ok: false, provider, error: error instanceof Error ? error.message : "Email send failed." };
  }
}
