import { NotificationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function createNotification(input: {
  workspaceId: string;
  userId?: string;
  title: string;
  body?: string;
  channel?: string;
  metadata?: Record<string, unknown>;
}) {
  return prisma.notification.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId ?? null,
      title: input.title,
      body: input.body ?? null,
      channel: input.channel ?? "in_app",
      status: "unread",
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });
}

export async function markNotificationStatus(input: {
  workspaceId: string;
  id: string;
  status: NotificationStatus;
}) {
  return prisma.notification.updateMany({
    where: { id: input.id, workspaceId: input.workspaceId },
    data: {
      status: input.status,
      readAt: input.status === "read" ? new Date() : undefined,
    },
  });
}

export async function listNotifications(workspaceId: string, userId?: string) {
  return prisma.notification.findMany({
    where: {
      workspaceId,
      OR: [{ userId: null }, { userId: userId ?? null }],
      status: { not: "dismissed" },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}
