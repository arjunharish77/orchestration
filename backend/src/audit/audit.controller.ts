import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AccessService } from '../access/access.service';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/auth.guard';
import { PrismaService } from '../prisma/prisma.service';

type AuthenticatedRequest = {
  user: AuthenticatedUser;
};

@Controller('audit-logs')
export class AuditController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessService: AccessService
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(
    @Req() request: AuthenticatedRequest,
    @Query('module') moduleName?: string,
    @Query('entityId') entityId?: string,
    @Query('action') action?: string,
    @Query('changedBy') changedBy?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('includeTotal') includeTotal?: string
  ) {
    await this.accessService.assertModulePermission(request.user.id, 'Audit', 'viewAuditLogs');
    const where: Prisma.AuditLogWhereInput = {
      moduleName,
      entityId,
      action,
      changedBy,
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {})
            }
          }
        : {})
    };

    const pageNumber = clampInt(page, 1, 100000, 1);
    const take = clampInt(pageSize, 1, 500, 200);
    const skip = (pageNumber - 1) * take;
    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip
    });
    if (includeTotal === 'true') {
      const total = await this.prisma.auditLog.count({ where });
      return { rows, total, page: pageNumber, pageSize: take };
    }
    return rows;
  }
}

function clampInt(value: string | undefined, min: number, max: number, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}
