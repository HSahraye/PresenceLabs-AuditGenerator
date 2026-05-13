import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getEnv, isAuthEnabled } from "./env";

export type AppRole = "admin" | "sales" | "viewer";
const SESSION_COOKIE = "pl_session";

type SessionPayload = {
  role: AppRole;
  exp: number;
};

function getSessionSecret() {
  const env = getEnv();
  return env.SESSION_SECRET || "dev-insecure-session-secret";
}

function sign(value: string) {
  return crypto.createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

function encodeSession(payload: SessionPayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = sign(body);
  return `${body}.${mac}`;
}

function decodeSession(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = sign(body);
  if (expected.length !== mac.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(mac))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!payload || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function readRoleFromSessionToken(token: string | undefined): AppRole | null {
  return decodeSession(token)?.role ?? null;
}

export async function issueSession(role: AppRole) {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 12;
  const token = encodeSession({ role, exp });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: getEnv().NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentRole(): Promise<AppRole | null> {
  if (!isAuthEnabled()) return "admin";
  const cookieStore = await cookies();
  const session = decodeSession(cookieStore.get(SESSION_COOKIE)?.value);
  return session?.role ?? null;
}

export async function requireRole(roles: AppRole[]) {
  const role = await getCurrentRole();
  if (!role || !roles.includes(role)) {
    redirect("/login");
  }
  return role;
}

export function resolveRoleFromPassword(password: string): AppRole | null {
  const env = getEnv();
  if (env.AUTH_ADMIN_PASSWORD && password === env.AUTH_ADMIN_PASSWORD) return "admin";
  if (env.AUTH_SALES_PASSWORD && password === env.AUTH_SALES_PASSWORD) return "sales";
  if (env.AUTH_VIEWER_PASSWORD && password === env.AUTH_VIEWER_PASSWORD) return "viewer";
  return null;
}

export function isInternalPath(pathname: string) {
  if (pathname.startsWith("/audit/")) return false;
  if (pathname.startsWith("/api/public/")) return false;
  if (pathname.startsWith("/api/stripe/webhook")) return false;
  if (pathname.startsWith("/login")) return false;
  if (pathname.startsWith("/_next")) return false;
  if (pathname === "/favicon.ico") return false;
  return true;
}
