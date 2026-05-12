import { Job } from 'bullmq';
import { prisma, systemActor } from '../context';
import { toJson } from '../utils';

export async function processOfferExpiry(job: Job<{ limit?: number; actor?: string }>) {
  const actor = job.data.actor ?? systemActor;
  const leads = await prisma.lead.findMany({
    where: {
      offerExpiryDate: { lt: new Date() },
      status: { notIn: ['Converted', 'Expired'] }
    },
    take: job.data.limit ?? 250
  });
  for (const lead of leads) {
    await prisma.lead.update({ where: { id: lead.id }, data: { status: 'Expired', updatedBy: actor } });
    await prisma.leadStatusHistory.create({
      data: {
        leadId: lead.id,
        oldStatus: lead.status,
        newStatus: 'Expired',
        oldCategory: lead.category,
        newCategory: lead.category,
        remarks: 'Offer expired by worker',
        createdBy: actor
      }
    });
    await prisma.activity.create({
      data: {
        leadId: lead.id,
        type: '008',
        title: 'Offer expired',
        metadata: toJson({ offerExpiryDate: lead.offerExpiryDate }),
        createdBy: actor
      }
    });
  }
  return { ok: true, expired: leads.length };
}
