import dns from "node:dns/promises";
import net from "node:net";

const blockedHostPatterns = [/^localhost$/i, /\.local$/i, /\.internal$/i, /^0\.0\.0\.0$/, /^127\./];

function isPrivateIp(ip: string) {
  if (net.isIP(ip) === 4) {
    if (ip.startsWith("10.")) return true;
    if (ip.startsWith("127.")) return true;
    if (ip.startsWith("169.254.")) return true;
    if (ip.startsWith("192.168.")) return true;
    const [a, b] = ip.split(".").map((p) => Number(p));
    if (a === 172 && b >= 16 && b <= 31) return true;
    return false;
  }
  if (net.isIP(ip) === 6) {
    return ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80:");
  }
  return false;
}

export async function validateExternalUrl(urlString: string) {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return { ok: false as const, reason: "Invalid URL format." };
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { ok: false as const, reason: "Only http/https URLs are allowed." };
  }
  if (blockedHostPatterns.some((pattern) => pattern.test(parsed.hostname))) {
    return { ok: false as const, reason: "Internal hostnames are not allowed." };
  }
  if (net.isIP(parsed.hostname) && isPrivateIp(parsed.hostname)) {
    return { ok: false as const, reason: "Private IP targets are blocked." };
  }
  try {
    const records = await dns.lookup(parsed.hostname, { all: true });
    if (records.some((record) => isPrivateIp(record.address))) {
      return { ok: false as const, reason: "Resolved private IP target is blocked." };
    }
  } catch {
    // If DNS lookup fails, let fetch handle the final error.
  }
  return { ok: true as const, url: parsed.toString() };
}
