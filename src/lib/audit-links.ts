import crypto from "node:crypto";
import { getEnv } from "./env";

type AuditTokenPayload = {
  leadId: string;
  exp: number;
};

function b64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

function unb64url(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function sign(payload: string) {
  const env = getEnv();
  const secret = env.AUDIT_LINK_SECRET || env.SESSION_SECRET || "dev-insecure-audit-secret";
  return b64url(crypto.createHmac("sha256", secret).update(payload).digest());
}

export function createAuditAccessToken(leadId: string, ttlSeconds = Number(getEnv().AUDIT_LINK_TTL_SECONDS || "604800")) {
  const payload: AuditTokenPayload = {
    leadId,
    exp: Math.floor(Date.now() / 1000) + Math.max(60, ttlSeconds),
  };
  const encodedPayload = b64url(JSON.stringify(payload));
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyAuditAccessToken(token: string, leadId: string) {
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [encodedPayload, providedSignature] = parts;
  const expected = sign(encodedPayload);
  if (expected.length !== providedSignature.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(providedSignature))) return false;
  const raw = unb64url(encodedPayload);
  const payload = JSON.parse(raw) as AuditTokenPayload;
  if (!payload || payload.leadId !== leadId) return false;
  if (payload.exp < Math.floor(Date.now() / 1000)) return false;
  return true;
}

export function buildSignedAuditPath(leadId: string) {
  const token = createAuditAccessToken(leadId);
  return `/audit/${leadId}?token=${encodeURIComponent(token)}`;
}

export function buildShortAuditPath(shortSlug: string) {
  return `/a/${encodeURIComponent(shortSlug)}`;
}

export function buildPreferredAuditPath(input: { leadId: string; shortSlug?: string | null }) {
  if (input.shortSlug) return buildShortAuditPath(input.shortSlug);
  return buildSignedAuditPath(input.leadId);
}
