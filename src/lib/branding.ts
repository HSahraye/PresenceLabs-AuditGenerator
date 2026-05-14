type WorkspaceSettingsLike = Partial<{
  senderCompanyName: string | null;
  brandName: string | null;
  agencyName: string | null;
  publicCompanyName: string | null;
}>;

const INTERNAL_WORKSPACE_NAMES = new Set(["default workspace", "workspace", "default"]);

function clean(value?: string | null) {
  return (value || "").trim();
}

export function resolvePublicSenderName(
  workspaceSettings?: WorkspaceSettingsLike | null,
) {
  const candidates = [
    clean(workspaceSettings?.publicCompanyName),
    clean(workspaceSettings?.senderCompanyName),
    clean(workspaceSettings?.agencyName),
    clean(workspaceSettings?.brandName),
    "Presence Labs",
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (INTERNAL_WORKSPACE_NAMES.has(candidate.toLowerCase())) continue;
    return candidate;
  }

  return "Presence Labs";
}

export function sanitizePublicBrandCopy(copy: string) {
  return copy
    .replace(/\bfrom\s+default workspace\b/gi, "from Presence Labs")
    .replace(/\bdefault workspace\b/gi, "Presence Labs");
}
