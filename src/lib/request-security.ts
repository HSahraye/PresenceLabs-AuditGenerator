import crypto from "node:crypto";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { checkRateLimit } from "./rate-limit";

export async function getClientRequestMeta() {
  const headerStore = await headers();
  const userAgent = headerStore.get("user-agent") ?? null;
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headerStore.get("x-real-ip") ?? null;
  return { userAgent, ip };
}

export async function enforceRateLimit(
  routeKey: string,
  limit = 45,
  windowMs = 60_000,
  identity?: string,
) {
  const { ip } = await getClientRequestMeta();
  const key = `${routeKey}:${identity || ip || "anonymous"}`;
  const result = checkRateLimit(key, limit, windowMs);
  if (result.ok) return null;
  return NextResponse.json(
    { ok: false, error: "Rate limit exceeded. Please try again soon." },
    { status: 429, headers: { "retry-after": String(Math.max(1, Math.round((result.resetAt - Date.now()) / 1000))) } },
  );
}

export function verifyHmacSignature({
  rawBody,
  providedSignature,
  secret,
}: {
  rawBody: string;
  providedSignature: string;
  secret: string;
}) {
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  if (expected.length !== providedSignature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(providedSignature));
}
