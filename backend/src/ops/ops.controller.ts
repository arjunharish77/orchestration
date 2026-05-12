import { Body, Controller, Get, NotFoundException, Post, Query, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { readFile } from 'fs/promises';
import Redis from 'ioredis';
import { join, resolve } from 'path';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { requiredConfigValue } from '../common/env';
import { PrismaService } from '../prisma/prisma.service';
import { OpsGuard } from './ops.guard';

class OpsLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

const whitelistedTables = ['Lead', 'Task', 'Activity', 'LeadUploadBatch', 'LeadUploadRow', 'ConnectorEvent', 'AutomationRun', 'AuditLog'];

@Controller('ops')
export class OpsController {
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService
  ) {}

  @Post('login')
  async login(@Body() body: OpsLoginDto) {
    const email = this.config.get<string>('OPS_EMAIL');
    const passwordHash = this.config.get<string>('OPS_PASSWORD_HASH');
    if (!email || !passwordHash) throw new NotFoundException('Ops login is disabled');
    if (body.email.toLowerCase() !== email.toLowerCase()) throw new UnauthorizedException('Invalid ops credentials');
    const valid = await bcrypt.compare(body.password, passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid ops credentials');
    return {
      accessToken: await this.jwt.signAsync({ ops: true, email }, { expiresIn: '4h' })
    };
  }

  @Get('health')
  @UseGuards(OpsGuard)
  health() {
    return {
      status: 'ok',
      service: 'ops',
      enabled: Boolean(this.config.get<string>('OPS_EMAIL') && this.config.get<string>('OPS_PASSWORD_HASH')),
      timestamp: new Date().toISOString()
    };
  }

  @Get('logs')
  @UseGuards(OpsGuard)
  async logs(@Query('file') file = 'app.log') {
    const logDir = resolve(this.config.get<string>('LOG_DIR') ?? join(process.cwd(), '..', 'logs'));
    const target = resolve(logDir, file);
    if (!target.startsWith(logDir) || !['app.log', 'error.log', 'worker.log'].includes(file)) {
      throw new NotFoundException('Log file not allowed');
    }
    const text = await readFile(target, 'utf8').catch(() => '');
    return { file, content: redact(text).slice(-50_000) };
  }

  @Get('files')
  @UseGuards(OpsGuard)
  async file(@Query('path') path = '') {
    const uploadDir = resolve(this.config.get<string>('UPLOAD_DIR') ?? join(process.cwd(), '..', 'uploads'));
    const target = resolve(uploadDir, path);
    if (!target.startsWith(uploadDir)) throw new NotFoundException('File path not allowed');
    const content = await readFile(target, 'utf8').catch(() => '');
    return { path, content: redact(content).slice(0, 50_000) };
  }

  @Get('db')
  @UseGuards(OpsGuard)
  async db(@Query('table') table?: string) {
    if (!table) return { tables: whitelistedTables };
    if (!whitelistedTables.includes(table)) throw new NotFoundException('Table not allowed');
    const model = modelName(table);
    const delegate = (this.prisma as unknown as Record<string, { findMany: (args: unknown) => Promise<unknown[]>; count: () => Promise<number> }>)[model];
    if (!delegate) throw new NotFoundException('Table not available');
    const [count, rows] = await Promise.all([
      delegate.count(),
      delegate.findMany({ take: 50, orderBy: { createdAt: 'desc' } })
    ]);
    return { table, count, rows: maskRows(rows) };
  }

  @Get('queues')
  @UseGuards(OpsGuard)
  async queues() {
    const redis = new Redis(requiredConfigValue('REDIS_URL', this.config.get<string>('REDIS_URL'), 'redis://localhost:6379'), { lazyConnect: true, maxRetriesPerRequest: 1 });
    try {
      await redis.connect();
      const keys = await redis.keys('health:workers:*');
      const values = await Promise.all(keys.map((key) => redis.get(key)));
      return {
        queues: keys.map((key, index) => ({ key, heartbeat: values[index] ? JSON.parse(values[index] as string) : null }))
      };
    } finally {
      redis.disconnect();
    }
  }
}

function modelName(table: string) {
  return table.charAt(0).toLowerCase() + table.slice(1);
}

function redact(text: string) {
  return text.replace(/(token|secret|password|authorization|api[_-]?key)["':=\s]+[^"',\s]+/gi, '$1=[masked]');
}

function maskRows(rows: unknown[]) {
  return JSON.parse(JSON.stringify(rows, (key, value) => /password|token|secret|authorization|api[_-]?key/i.test(key) ? '[masked]' : value));
}
