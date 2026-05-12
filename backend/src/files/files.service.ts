import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { AccessService } from '../access/access.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService
  ) {}

  async list(userId: string) {
    const effective = await this.access.effectivePermissions(userId);
    return this.prisma.uploadedFile.findMany({
      where: effective.isAdministrator ? {} : { uploadedBy: userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        fileName: true,
        fileType: true,
        uploadedBy: true,
        createdAt: true
      }
    });
  }

  async upload(file: { originalname?: string; buffer?: Buffer }, fileType: string, userId: string) {
    if (!file?.buffer) throw new NotFoundException('File is required');
    const normalizedType = normalizeUploadFileType(fileType);
    if (normalizedType === 'shared-document') {
      await this.access.assertModulePermission(userId, 'Lead', 'edit');
    } else {
      await this.access.assertModulePermission(userId, 'Settings', 'edit');
    }

    const fileName = safeStorageName(file.originalname ?? `${normalizedType}-${Date.now()}`);
    const fileDir = join(process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads'), normalizedType);
    await mkdir(fileDir, { recursive: true });
    const filePath = join(fileDir, `${Date.now()}-${fileName}`);
    await writeFile(filePath, file.buffer);

    return this.prisma.uploadedFile.create({
      data: {
        fileName,
        filePath,
        fileType: normalizedType,
        uploadedBy: userId
      },
      select: {
        id: true,
        fileName: true,
        fileType: true,
        uploadedBy: true,
        createdAt: true
      }
    });
  }

  async download(id: string, userId: string) {
    const file = await this.prisma.uploadedFile.findUnique({ where: { id } });
    if (!file) throw new NotFoundException('File not found');

    await this.assertDownloadPermission(userId, file.fileType, file.uploadedBy);

    return {
      fileName: file.fileName,
      contentType: contentTypeFor(file.fileName, file.fileType),
      buffer: await readFile(file.filePath)
    };
  }

  async cleanupTemporaryFiles(userId: string, olderThanDays = 7) {
    await this.access.assertModulePermission(userId, 'Settings', 'edit');
    const cutoff = new Date(Date.now() - Math.max(1, Math.min(365, olderThanDays)) * 24 * 60 * 60 * 1000);
    const files = await this.prisma.uploadedFile.findMany({
      where: {
        fileType: 'temporary',
        createdAt: { lt: cutoff }
      }
    });

    for (const file of files) {
      await unlink(file.filePath).catch(() => undefined);
    }

    await this.prisma.uploadedFile.deleteMany({
      where: {
        id: { in: files.map((file) => file.id) }
      }
    });

    return {
      deleted: files.length,
      olderThanDays
    };
  }

  async retentionPolicy(userId: string) {
    await this.access.assertModulePermission(userId, 'Settings', 'view');
    return retentionPolicy();
  }

  async applyRetention(userId: string, dryRun = true) {
    await this.access.assertModulePermission(userId, 'Settings', 'edit');
    const policy = retentionPolicy();
    const cutoffs = {
      auditLogs: daysAgo(policy.auditLogs.days),
      connectorEvents: daysAgo(policy.connectorEvents.days),
      automationLogs: daysAgo(policy.automationLogs.days),
      uploadedFiles: daysAgo(policy.uploadedFiles.days),
      reportExports: daysAgo(policy.reportExports.days),
      telephonyRecords: daysAgo(policy.telephonyRecords.days)
    };

    const uploadedFiles = await this.prisma.uploadedFile.findMany({
      where: {
        createdAt: { lt: cutoffs.uploadedFiles },
        OR: [{ fileType: 'temporary' }, { fileType: { startsWith: 'report/' } }, { fileType: { startsWith: 'lead-upload/' } }]
      },
      select: { id: true, filePath: true }
    });

    const counts = {
      auditLogs: await this.prisma.auditLog.count({ where: { createdAt: { lt: cutoffs.auditLogs } } }),
      connectorEvents: await this.prisma.connectorEvent.count({ where: { createdAt: { lt: cutoffs.connectorEvents } } }),
      automationApiCallLogs: await this.prisma.automationApiCallLog.count({ where: { createdAt: { lt: cutoffs.automationLogs } } }),
      automationRunSteps: await this.prisma.automationRunStep.count({ where: { run: { completedAt: { lt: cutoffs.automationLogs } } } }),
      automationRuns: await this.prisma.automationRun.count({ where: { completedAt: { lt: cutoffs.automationLogs } } }),
      uploadedFiles: uploadedFiles.length,
      reportExports: await this.prisma.reportExport.count({ where: { requestedAt: { lt: cutoffs.reportExports } } }),
      telephonyRouteRequests: await this.prisma.telephonyRouteRequest.count({ where: { createdAt: { lt: cutoffs.telephonyRecords } } }),
      telephonyPopupEvents: await this.prisma.telephonyAgentPopupEvent.count({ where: { createdAt: { lt: cutoffs.telephonyRecords } } }),
      telephonyCallLogEvents: await this.prisma.telephonyCallLogEvent.count({ where: { createdAt: { lt: cutoffs.telephonyRecords } } }),
      telephonyCalls: await this.prisma.telephonyCall.count({ where: { createdAt: { lt: cutoffs.telephonyRecords } } })
    };

    if (dryRun) return { dryRun: true, policy, cutoffs, counts };

    for (const file of uploadedFiles) {
      await unlink(file.filePath).catch(() => undefined);
    }
    await this.prisma.$transaction([
      this.prisma.connectorEvent.deleteMany({ where: { createdAt: { lt: cutoffs.connectorEvents } } }),
      this.prisma.automationApiCallLog.deleteMany({ where: { createdAt: { lt: cutoffs.automationLogs } } }),
      this.prisma.automationRunStep.deleteMany({ where: { run: { completedAt: { lt: cutoffs.automationLogs } } } }),
      this.prisma.automationRun.deleteMany({ where: { completedAt: { lt: cutoffs.automationLogs } } }),
      this.prisma.uploadedFile.deleteMany({ where: { id: { in: uploadedFiles.map((file) => file.id) } } }),
      this.prisma.reportExport.deleteMany({ where: { requestedAt: { lt: cutoffs.reportExports } } }),
      this.prisma.telephonyRouteRequest.deleteMany({ where: { createdAt: { lt: cutoffs.telephonyRecords } } }),
      this.prisma.telephonyAgentPopupEvent.deleteMany({ where: { createdAt: { lt: cutoffs.telephonyRecords } } }),
      this.prisma.telephonyCallLogEvent.deleteMany({ where: { createdAt: { lt: cutoffs.telephonyRecords } } }),
      this.prisma.telephonyCall.deleteMany({ where: { createdAt: { lt: cutoffs.telephonyRecords } } }),
      ...(process.env.AUDIT_LOG_DELETE_ENABLED === 'true'
        ? [this.prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoffs.auditLogs } } })]
        : [])
    ]);

    return { dryRun: false, policy, cutoffs, counts };
  }

  private async assertDownloadPermission(userId: string, fileType?: string | null, uploadedBy?: string | null) {
    const effective = await this.access.effectivePermissions(userId);
    if (!effective.isAdministrator && uploadedBy && uploadedBy !== userId) {
      throw new ForbiddenException('You can only download files generated or uploaded by you');
    }

    if (fileType?.startsWith('report/')) {
      await this.access.assertModulePermission(userId, 'Report', 'export');
      return;
    }

    if (fileType?.startsWith('lead-upload/')) {
      await this.access.assertModulePermission(userId, 'Lead', 'export');
      return;
    }

    await this.access.assertModulePermission(userId, 'Settings', 'view');
  }
}

function normalizeUploadFileType(fileType: string) {
  if (fileType === 'temporary') return 'temporary';
  if (fileType === 'shared-document') return 'shared-document';
  return 'shared-document';
}

function safeStorageName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function contentTypeFor(fileName: string, fileType?: string | null) {
  if (fileName.toLowerCase().endsWith('.csv') || fileType?.includes('csv')) return 'text/csv';
  if (fileName.toLowerCase().endsWith('.json')) return 'application/json';
  return 'application/octet-stream';
}

function retentionPolicy() {
  return {
    auditLogs: {
      days: envInt('AUDIT_LOG_RETENTION_DAYS', 2555),
      mode: process.env.AUDIT_LOG_DELETE_ENABLED === 'true' ? 'delete_after_retention' : 'archive_before_delete'
    },
    connectorEvents: { days: envInt('CONNECTOR_EVENT_RETENTION_DAYS', 365), mode: 'delete_after_retention' },
    automationLogs: { days: envInt('AUTOMATION_LOG_RETENTION_DAYS', 365), mode: 'delete_after_retention' },
    uploadedFiles: { days: envInt('UPLOADED_FILE_RETENTION_DAYS', 365), mode: 'delete_file_and_record' },
    reportExports: { days: envInt('REPORT_EXPORT_RETENTION_DAYS', 180), mode: 'delete_after_retention' },
    telephonyRecords: { days: envInt('TELEPHONY_RECORD_RETENTION_DAYS', 365), mode: 'delete_after_retention' }
  };
}

function envInt(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}
