import { prisma } from '../context';
import { logWorker } from '../logger';

function nextRunFromFrequency(frequency: string): Date {
  const date = new Date();
  if (frequency === 'weekly') date.setDate(date.getDate() + 7);
  else if (frequency === 'monthly') date.setMonth(date.getMonth() + 1);
  else date.setDate(date.getDate() + 1);
  date.setHours(8, 0, 0, 0);
  return date;
}

async function generateReportSummary(reportType: string, filters: Record<string, unknown>) {
  const dateFrom = typeof filters.dateFrom === 'string' ? new Date(filters.dateFrom) : undefined;
  const dateTo = typeof filters.dateTo === 'string' ? new Date(filters.dateTo) : undefined;
  const createdAt = dateFrom || dateTo ? {
    ...(dateFrom ? { gte: dateFrom } : {}),
    ...(dateTo ? { lte: dateTo } : {})
  } : undefined;

  if (reportType === 'lead-summary' || reportType === 'leads') {
    const [total, converted, expired, inProgress] = await Promise.all([
      prisma.lead.count({ where: { ...(createdAt ? { createdAt } : {}) } }),
      prisma.lead.count({ where: { status: 'Converted', ...(createdAt ? { createdAt } : {}) } }),
      prisma.lead.count({ where: { status: 'Expired', ...(createdAt ? { createdAt } : {}) } }),
      prisma.lead.count({ where: { status: 'In Progress', ...(createdAt ? { createdAt } : {}) } })
    ]);
    return { reportType, total, converted, expired, inProgress, conversionRate: total > 0 ? ((converted / total) * 100).toFixed(1) + '%' : '0%' };
  }

  if (reportType === 'task-summary' || reportType === 'tasks') {
    const now = new Date();
    const [total, completed, missed, pending] = await Promise.all([
      prisma.task.count({ where: { ...(createdAt ? { createdAt } : {}) } }),
      prisma.task.count({ where: { status: 'Completed', ...(createdAt ? { createdAt } : {}) } }),
      prisma.task.count({ where: { dueDate: { lt: now }, status: { not: 'Completed' }, ...(createdAt ? { createdAt } : {}) } }),
      prisma.task.count({ where: { status: 'Pending', ...(createdAt ? { createdAt } : {}) } })
    ]);
    return { reportType, total, completed, missed, pending };
  }

  if (reportType === 'activity-summary' || reportType === 'activities') {
    const [total, calls, meetings, notes] = await Promise.all([
      prisma.activity.count({ where: { ...(createdAt ? { createdAt } : {}) } }),
      prisma.activity.count({ where: { type: '001', ...(createdAt ? { createdAt } : {}) } }),
      prisma.activity.count({ where: { type: '002', ...(createdAt ? { createdAt } : {}) } }),
      prisma.activity.count({ where: { type: '003', ...(createdAt ? { createdAt } : {}) } })
    ]);
    return { reportType, total, calls, meetings, notes };
  }

  return { reportType, note: 'Report type not supported for scheduled generation' };
}

export async function pollScheduledReports() {
  const now = new Date();
  const dueReports = await prisma.scheduledReport.findMany({
    where: { isActive: true, nextRunAt: { lte: now } },
    take: 20,
    orderBy: { nextRunAt: 'asc' }
  });

  for (const report of dueReports) {
    const nextRunAt = nextRunFromFrequency(report.frequency);
    try {
      const filters = report.filters && typeof report.filters === 'object' && !Array.isArray(report.filters)
        ? report.filters as Record<string, unknown>
        : {};
      const summary = await generateReportSummary(report.reportType, filters);
      const recipients = Array.isArray(report.recipients) ? report.recipients.map(String) : [];

      logWorker('info', 'scheduled_report_executed', {
        reportId: report.id,
        reportType: report.reportType,
        frequency: report.frequency,
        recipients,
        summary
      });

      await prisma.scheduledReport.update({
        where: { id: report.id },
        data: { lastRunAt: now, nextRunAt }
      });
    } catch (error) {
      logWorker('error', 'scheduled_report_failed', {
        reportId: report.id,
        reportType: report.reportType,
        error: error instanceof Error ? error.message : String(error)
      });
      await prisma.scheduledReport.update({
        where: { id: report.id },
        data: { nextRunAt }
      });
    }
  }
}
