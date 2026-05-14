function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function getClientPublicBaseUrl() {
  const explicit = (process.env.NEXT_PUBLIC_APP_URL || "").trim();
  if (explicit) {
    if (/^https?:\/\//i.test(explicit)) return stripTrailingSlash(explicit);
    return stripTrailingSlash(`https://${explicit}`);
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return stripTrailingSlash(window.location.origin);
  }
  return "http://localhost:3000";
}

export function buildClientPublicUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getClientPublicBaseUrl()}${normalizedPath}`;
}
