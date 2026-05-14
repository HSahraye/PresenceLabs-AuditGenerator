import { TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function createTask(input: {
  workspaceId: string;
  leadId?: string;
  title: string;
  description?: string;
  status?: TaskStatus;
  dueAt?: Date;
  assignedToUserId?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}) {
  return prisma.task.create({
    data: {
      workspaceId: input.workspaceId,
      leadId: input.leadId ?? null,
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? "todo",
      dueAt: input.dueAt ?? null,
      assignedToUserId: input.assignedToUserId ?? null,
      source: input.source ?? "manual",
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });
}

export async function completeTask(taskId: string, workspaceId: string) {
  return prisma.task.updateMany({
    where: { id: taskId, workspaceId },
    data: {
      status: "done",
    },
  });
}
