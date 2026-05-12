import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { assertProductionValue } from './env';

export function assertWebhookSecret(input: { configuredSecret?: string; providedSecret?: string }) {
  if (!input.configuredSecret) {
    if (process.env.NODE_ENV === 'production') throw new UnauthorizedException('Webhook secret is required');
    return;
  }
  assertProductionValue('WEBHOOK_SECRET', input.configuredSecret);
  const configured = Buffer.from(input.configuredSecret);
  const provided = Buffer.from(input.providedSecret ?? '');
  if (!input.providedSecret || configured.length !== provided.length || !timingSafeEqual(configured, provided)) {
    throw new UnauthorizedException('Invalid webhook secret');
  }
}

export function assertWebhookSignature(input: { configuredSecret?: string; rawBody?: string; signature?: string }) {
  if (!input.configuredSecret) {
    if (process.env.NODE_ENV === 'production') throw new UnauthorizedException('Webhook signature secret is required');
    return;
  }
  assertProductionValue('WEBHOOK_SIGNATURE_SECRET', input.configuredSecret);
  if (!input.rawBody || !input.signature) throw new UnauthorizedException('Missing webhook signature');
  const expected = createHmac('sha256', input.configuredSecret).update(input.rawBody).digest('hex');
  const actual = input.signature.replace(/^sha256=/i, '');
  try {
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(actual))) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  } catch (error) {
    if (error instanceof UnauthorizedException) throw error;
    throw new BadRequestException('Invalid webhook signature format');
  }
}
