import { getPublicBaseUrl } from "@/lib/url";

export function getWorkspaceAuditBaseUrl(input: {
  customDomain?: string | null;
  auditSubdomain?: string | null;
}) {
  if (input.customDomain) {
    return `https://${input.customDomain.replace(/^https?:\/\//, "")}`;
  }
  if (input.auditSubdomain) {
    const root = getPublicBaseUrl().replace(/^https?:\/\//, "");
    return `https://${input.auditSubdomain}.${root}`;
  }
  return getPublicBaseUrl();
}
