import { PrismaClient } from '@prisma/client';
import IORedis from 'ioredis';
import { createAssignmentRunner } from './assignment-runner';
import { requiredEnv } from './env';

export const systemActor = 'system@unnatify.local';
export const prisma = new PrismaClient();
export const connection = new IORedis(requiredEnv('REDIS_URL', 'redis://localhost:6379'), {
  maxRetriesPerRequest: null,
  lazyConnect: process.env.NODE_ENV === 'test'
});
export const activityTypeCodes = {
  upload: '010',
  whatsapp: '005',
  voicebot: '006',
  call: '001',
  assignment: '011'
} as const;

function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? {}));
}

export const assignmentRunner = createAssignmentRunner({ prisma, systemActor, activityTypeCodes, toJson });
