import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { getRequestContext } from '../common/request-context';
import { maskSensitive } from '../common/sensitive';
import { PrismaService } from '../prisma/prisma.service';

type AuditInput = {
  moduleName: string;
  entityId?: string | null;
  action: string;
  oldValue?: unknown;
  newValue?: unknown;
  changedBy?: string | null;
  changedByType?: string;
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  write(input: AuditInput) {
    const requestContext = getRequestContext();
    return this.prisma.auditLog.create({
      data: {
        moduleName: input.moduleName,
        entityId: input.entityId,
        action: input.action,
        oldValue: toJson(input.oldValue),
        newValue: toJson(input.newValue),
        changedBy: input.changedBy ?? 'system',
        changedByType: input.changedByType ?? 'user',
        requestId: input.requestId ?? requestContext?.requestId,
        ipAddress: input.ipAddress ?? requestContext?.ipAddress,
        userAgent: input.userAgent ?? requestContext?.userAgent
      }
    });
  }
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(maskSensitive(value))) as Prisma.InputJsonValue;
}
