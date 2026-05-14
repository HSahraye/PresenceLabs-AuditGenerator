import { prisma } from "@/lib/prisma";

const cache = new Map<string, { enabled: boolean; expiresAt: number }>();

export async function isFeatureEnabled(input: { workspaceId?: string | null; key: string; defaultValue?: boolean }) {
  const workspaceId = input.workspaceId ?? null;
  const cacheKey = `${workspaceId || "global"}:${input.key}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.enabled;

  const flag = workspaceId
    ? await prisma.featureFlag.findUnique({
        where: { workspaceId_key: { workspaceId, key: input.key } },
      })
    : await prisma.featureFlag.findFirst({
        where: { workspaceId: null, key: input.key },
      });
  if (!flag) return input.defaultValue ?? false;
  const enabled = flag.enabled && Math.max(0, Math.min(100, flag.rolloutPct)) > 0;
  cache.set(cacheKey, { enabled, expiresAt: Date.now() + 30_000 });
  return enabled;
}
