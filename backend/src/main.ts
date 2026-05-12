import './instrument';
import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/http-exception.filter';
import { requiredConfigValue } from './common/env';
import { simpleRateLimit } from './common/rate-limit';
import { requestContextMiddleware } from './common/request-context';
import { csrfProtection, securityHeaders } from './common/security';
import { requestLoggingMiddleware, StructuredLogger } from './common/structured-logger';

const { json, urlencoded } = require('express') as {
  json: (options: Record<string, unknown>) => unknown;
  urlencoded: (options: Record<string, unknown>) => unknown;
};

async function bootstrap() {
  const logger = new StructuredLogger();
  const app = await NestFactory.create(AppModule, { logger, bodyParser: false });
  const config = app.get(ConfigService);
  const appUrl = requiredConfigValue('APP_URL', config.get<string>('APP_URL'), 'http://localhost:3000');

  const allowedOrigins = allowedCorsOrigins(config, appUrl);
  app.enableCors({
    origin: allowedOrigins,
    credentials: true
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true
    })
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();
  app.use(json({ limit: '2mb', verify: rawBodyVerifier }));
  app.use(urlencoded({ extended: true, limit: '25mb', verify: rawBodyVerifier }));
  app.use(requestContextMiddleware());
  app.use(securityHeaders());
  app.use(csrfProtection());
  app.use(simpleRateLimit({ windowMs: 60_000, max: 300, pathPrefixes: ['/'] }));
  app.use(simpleRateLimit({ windowMs: 60_000, max: 30, pathPrefixes: ['/auth/login', '/auth/email-otp', '/auth/password-reset', '/webhooks', '/connectors/whatsapp/webhook', '/connectors/voicebot/webhook'] }));
  app.use(simpleRateLimit({ windowMs: 60_000, max: 5, pathPrefixes: ['/ops/login'] }));
  app.use(requestLoggingMiddleware(logger));

  const port = config.get<number>('PORT') ?? 4000;
  await app.listen(port);
}

bootstrap();

function rawBodyVerifier(request: { rawBody?: string }, _response: unknown, buffer: Buffer) {
  if (buffer?.length) request.rawBody = buffer.toString('utf8');
}

function allowedCorsOrigins(config: ConfigService, appUrl: string) {
  const configured = (config.get<string>('CORS_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (configured.length > 0) return configured;
  if (config.get<string>('NODE_ENV') === 'production') {
    return [requiredConfigValue('CORS_ORIGINS or APP_URL', appUrl, 'http://localhost:3000')];
  }
  return [
    appUrl,
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001'
  ];
}
