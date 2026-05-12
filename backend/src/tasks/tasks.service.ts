import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AccessService } from '../access/access.service';
import { activityTypeCodes } from '../activities/activity-types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskCommentDto, CreateTaskDto, UpdateTaskDto } from './tasks.dto';

const taskListSettingKeys = {
  type: 'task.type.values',
  status: 'task.status.values'
};

const defaultTaskListValues = {
  type: ['Follow-up', 'Callback', 'Document Collection', 'Call', 'Meeting', 'Reminder'],
  status: ['Pending', 'In Progress', 'Completed']
};

const fixedTaskPriorities = ['Low', 'Medium', 'High'];

type TaskListQuery = {
  leadId?: string;
  assignedTo?: string;
  status?: string;
  priority?: string;
  search?: string;
  dueAfter?: string;
  dueBefore?: string;
  pageSize?: string;
};

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly access: AccessService
  ) {}

  async list(query: TaskListQuery = {}, userId?: string) {
    const now = new Date();
    const effective = userId ? await this.access.effectivePermissions(userId) : null;
    const dueDate = this.dateRange(query.dueAfter, query.dueBefore);
    const search = query.search?.trim();
    const accessWhere: Prisma.TaskWhereInput = effective && !this.access.hasLeadAllScope(effective) ? { lead: { assignedUserId: userId } } : {};
    const statusWhere: Prisma.TaskWhereInput = query.status === 'Missed'
      ? { dueDate: { lt: now }, status: { not: 'Completed' } }
      : query.status
        ? { status: query.status }
        : {};
    const searchWhere: Prisma.TaskWhereInput = search
      ? {
          OR: [
            { taskType: { contains: search, mode: 'insensitive' } },
            { priority: { contains: search, mode: 'insensitive' } },
            { status: { contains: search, mode: 'insensitive' } },
            { remarks: { contains: search, mode: 'insensitive' } },
            { lead: { customerName: { contains: search, mode: 'insensitive' } } },
            { lead: { mobile: { contains: search, mode: 'insensitive' } } },
            { lead: { externalLeadId: { contains: search, mode: 'insensitive' } } }
          ]
        }
      : {};
    const take = clampInt(query.pageSize, 1, 500, 200);

    const tasks = await this.prisma.task.findMany({
      where: {
        AND: [
          query.leadId ? { leadId: query.leadId } : {},
          query.assignedTo ? { assignedTo: query.assignedTo } : {},
          query.priority ? { priority: query.priority } : {},
          dueDate ? { dueDate } : {},
          accessWhere,
          statusWhere,
          searchWhere
        ]
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      take,
      include: {
        comments: true,
        lead: {
          select: {
            id: true,
            customerName: true,
            mobile: true,
            externalLeadId: true
          }
        }
      }
    });

    return tasks.map((task) => ({
      ...task,
      status: task.dueDate && task.dueDate < now && task.status !== 'Completed' ? 'Missed' : task.status
    }));
  }

  async create(input: CreateTaskDto, actor = 'system') {
    const lead = await this.prisma.lead.findUnique({ where: { id: input.leadId } });
    if (!lead) throw new NotFoundException('Lead not found');
    await this.assertLeadVisible(input.leadId, actor);
    await this.assertAssigneeCanSeeLead(input.assignedTo, input.leadId);
    await this.assertValidTaskValues(input);
    const actorName = await this.actorDisplayName(actor);

    const task = await this.prisma.task.create({
      data: {
        leadId: input.leadId,
        assignedTo: input.assignedTo,
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        priority: input.priority,
        taskType: input.taskType,
        status: input.status ?? 'Pending',
        remarks: input.remarks,
        createdBy: actor,
        updatedBy: actor
      }
    });

    await Promise.all([
      input.leadId
        ? this.prisma.activity.create({
            data: {
              leadId: input.leadId,
              taskId: task.id,
              type: activityTypeCodes.task,
              title: `Task created: ${task.taskType} by ${actorName}`,
              notes: task.remarks,
              metadata: {
                dueDate: task.dueDate,
                priority: task.priority,
                assignedTo: task.assignedTo
              },
              createdBy: actor
            }
          })
        : Promise.resolve(),
      this.audit.write({
        moduleName: 'Task',
        entityId: task.id,
        action: 'create',
        newValue: task,
        changedBy: actor
      })
    ]);

    return task;
  }

  async update(id: string, input: UpdateTaskDto, actor = 'system') {
    const existing = await this.prisma.task.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Task not found');
    if (existing.leadId) await this.assertLeadVisible(existing.leadId, actor);
    if (existing.status === 'Completed') {
      const changedFields = Object.entries(input).filter(([key, value]) => key !== 'status' && value !== undefined);
      if (changedFields.length > 0) throw new BadRequestException('Completed tasks are read-only except status changes');
    }
    if (input.assignedTo && existing.leadId) await this.assertAssigneeCanSeeLead(input.assignedTo, existing.leadId);
    await this.assertValidTaskValues(input);
    const actorName = await this.actorDisplayName(actor);

    const task = await this.prisma.task.update({
      where: { id },
      data: {
        assignedTo: input.assignedTo,
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        priority: input.priority,
        taskType: input.taskType,
        status: input.status,
        remarks: input.remarks,
        updatedBy: actor
      }
    });

    await this.audit.write({
      moduleName: 'Task',
      entityId: id,
      action: 'update',
      oldValue: existing,
      newValue: task,
      changedBy: actor
    });

    if (existing.status !== 'Completed' && task.status === 'Completed' && task.leadId) {
      await this.prisma.activity.create({
        data: {
          leadId: task.leadId,
          taskId: task.id,
          type: activityTypeCodes.task,
          title: `Task completed: ${task.taskType} by ${actorName}`,
          notes: task.remarks,
          metadata: {
            completedAt: new Date(),
            priority: task.priority,
            assignedTo: task.assignedTo
          },
          createdBy: actor
        }
      });
    }

    return task;
  }

  async delete(id: string, actor = 'system') {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');
    if (task.leadId) await this.assertLeadVisible(task.leadId, actor);

    await this.prisma.task.delete({ where: { id } });
    await this.audit.write({
      moduleName: 'Task',
      entityId: id,
      action: 'delete',
      newValue: { deleted: true },
      changedBy: actor
    });
    return { ok: true };
  }

  async addComment(id: string, input: CreateTaskCommentDto, actor = 'system') {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');
    if (task.leadId) await this.assertLeadVisible(task.leadId, actor);

    const comment = await this.prisma.taskComment.create({
      data: {
        taskId: id,
        comment: input.comment,
        createdBy: actor
      }
    });

    await this.audit.write({
      moduleName: 'Task',
      entityId: id,
      action: 'comment',
      newValue: comment,
      changedBy: actor
    });

    return comment;
  }

  private async assertLeadVisible(leadId: string, userId: string) {
    if (!userId || userId === 'system' || userId === 'System') return;
    const effective = await this.access.effectivePermissions(userId);
    if (this.access.hasLeadAllScope(effective)) return;
    const lead = await this.prisma.lead.findFirst({ where: { id: leadId, assignedUserId: userId }, select: { id: true } });
    if (!lead) throw new NotFoundException('Lead not found');
  }

  private async assertAssigneeCanSeeLead(assignedUserId: string, leadId: string) {
    if (!assignedUserId || assignedUserId === 'system' || assignedUserId === 'System') return;
    const effective = await this.access.effectivePermissions(assignedUserId);
    if (this.access.hasLeadAllScope(effective)) return;
    const lead = await this.prisma.lead.findFirst({ where: { id: leadId, assignedUserId: assignedUserId }, select: { id: true } });
    if (!lead) throw new BadRequestException('Task assignee cannot access this lead');
  }

  private async actorDisplayName(actor: string) {
    if (!actor || actor === 'system' || actor === 'System') return 'System';
    const user = await this.prisma.user.findUnique({ where: { id: actor }, select: { name: true, email: true } });
    return user?.name ?? user?.email ?? 'User';
  }

  private dateRange(dueAfter?: string, dueBefore?: string): Prisma.DateTimeFilter | undefined {
    const after = parseDate(dueAfter);
    const before = parseDate(dueBefore);
    if (!after && !before) return undefined;
    return {
      ...(after ? { gte: after } : {}),
      ...(before ? { lte: before } : {})
    };
  }

  private async assertValidTaskValues(input: Partial<CreateTaskDto & UpdateTaskDto>) {
    const [taskTypes, taskStatuses] = await Promise.all([
      this.configuredTaskList('type'),
      this.configuredTaskList('status')
    ]);
    if (input.taskType && !taskTypes.includes(input.taskType)) throw new BadRequestException('Invalid task type');
    if (input.status && !taskStatuses.includes(input.status)) throw new BadRequestException('Invalid task status');
    if (input.priority && !fixedTaskPriorities.includes(input.priority)) throw new BadRequestException('Invalid task priority');
  }

  private async configuredTaskList(type: keyof typeof taskListSettingKeys) {
    const setting = await this.prisma.appSetting.findUnique({ where: { key: taskListSettingKeys[type] } });
    return Array.isArray(setting?.value)
      ? setting.value.map((entry) => String(entry)).filter(Boolean)
      : defaultTaskListValues[type];
  }
}

export function parseDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function clampInt(value: string | undefined, min: number, max: number, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}
