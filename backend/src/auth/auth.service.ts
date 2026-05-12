import { BadGatewayException, BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes, randomInt } from 'crypto';
import Redis from 'ioredis';
import { requiredConfigValue } from '../common/env';
import { toJsonValue } from '../common/json';
import { assertPasswordPolicy } from '../common/password-policy';
import { PrismaService } from '../prisma/prisma.service';

type SessionMeta = {
  userAgent?: string;
  ipAddress?: string;
};

@Injectable()
export class AuthService {
  private _redis: Redis | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService
  ) {}

  async login(email: string, password: string, meta: SessionMeta = {}) {
    const normalizedEmail = email.toLowerCase();
    await this.assertLoginNotLocked(normalizedEmail, meta);
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        role: true,
        team: true,
        permissionTemplate: true
      }
    });

    if (!user || !user.passwordHash || !user.isActive) {
      await this.recordFailedLogin(normalizedEmail, user?.id, 'invalid_credentials', meta);
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      await this.recordFailedLogin(normalizedEmail, user.id, 'invalid_credentials', meta);
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.clearFailedLogin(normalizedEmail);

    if (await this.isTwoFactorRequired(user)) {
      await this.requestEmailOtp(user.email);
      return {
        requiresEmailOtp: true,
        email: user.email,
        user: this.publicUser(user)
      };
    }

    return this.issueLoginResponse(user, meta);
  }

  async currentUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: true,
        team: true,
        permissionTemplate: true,
        salesGroups: {
          include: { salesGroup: true }
        },
        customValues: {
          include: { field: true }
        }
      }
    });

    if (!user || !user.isActive) throw new NotFoundException('User not found');

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role.name,
      team: user.team
        ? {
            id: user.team.id,
            name: user.team.name,
            code: user.team.code,
            type: user.team.type
          }
        : null,
      permissionTemplate: user.permissionTemplate
        ? {
            id: user.permissionTemplate.id,
            name: user.permissionTemplate.name
          }
        : null,
      salesGroups: user.salesGroups.map((entry) => ({
        id: entry.salesGroup.id,
        name: entry.salesGroup.name
      })),
      customFields: user.customValues.map((value) => ({
        key: value.field.fieldKey,
        label: value.field.label,
        value: value.value
      })),
      twoFactorEnabled: user.twoFactorEnabled,
      twoFactorDisabledByAdmin: user.twoFactorDisabledByAdmin
    };
  }

  async requestEmailOtp(email: string) {
    const user = await this.findActiveUser(email);
    const otp = String(randomInt(100000, 1000000));
    const redis = await this.getRedis();

    await redis.set(
      this.otpKey(user.email),
      JSON.stringify({
        hash: await bcrypt.hash(otp, 10),
        attempts: 0,
        createdAt: new Date().toISOString()
      }),
      'EX',
      600
    );

    await this.sendEmail({
      to: user.email,
      subject: 'Your Unnatify verification code',
      text: `Your Unnatify verification code is ${otp}. It expires in 10 minutes.`
    });

    return {
      status: 'sent',
      expiresInSeconds: 600
    };
  }

  async verifyEmailOtp(email: string, otp: string) {
    const normalizedEmail = email.toLowerCase();
    const redis = await this.getRedis();

    const key = this.otpKey(normalizedEmail);
    const stored = await redis.get(key);
    if (!stored) throw new BadRequestException('OTP expired or not requested');

    const payload = JSON.parse(stored) as { hash: string; attempts: number };
    if (payload.attempts >= 5) {
      await redis.del(key);
      throw new BadRequestException('OTP attempts exceeded');
    }

    const matches = await bcrypt.compare(otp, payload.hash);
    if (!matches) {
      await redis.set(key, JSON.stringify({ ...payload, attempts: payload.attempts + 1 }), 'KEEPTTL');
      throw new BadRequestException('Invalid OTP');
    }

    await redis.del(key);
    return {
      status: 'verified'
    };
  }

  async verifyLoginEmailOtp(email: string, otp: string, meta: SessionMeta = {}) {
    await this.verifyEmailOtp(email, otp);
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        role: true,
        team: true,
        permissionTemplate: true
      }
    });

    if (!user || !user.isActive || !user.passwordHash) throw new UnauthorizedException('Invalid login verification');

    return this.issueLoginResponse(user, meta);
  }

  async refreshSession(refreshToken: string) {
    const parsed = this.parseRefreshToken(refreshToken);
    const session = await this.prisma.authSession.findUnique({
      where: { id: parsed.sessionId },
      include: {
        user: {
          include: {
            role: true,
            team: true,
            permissionTemplate: true
          }
        }
      }
    });

    if (!session || session.revokedAt || session.expiresAt <= new Date() || !session.user.isActive) {
      throw new UnauthorizedException('Session expired');
    }

    const matches = await bcrypt.compare(parsed.secret, session.refreshTokenHash);
    if (!matches) {
      await this.prisma.authSession.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: new Date() }
      });
      throw new UnauthorizedException('Invalid refresh token');
    }

    const rotated = await this.rotateRefreshToken(session.id);

    return {
      accessToken: await this.signUserToken(session.user, session.id),
      refreshToken: rotated.refreshToken,
      refreshTokenExpiresAt: session.expiresAt.toISOString(),
      user: this.publicUser(session.user)
    };
  }

  async logout(sessionId?: string, refreshToken?: string) {
    const targetSessionId = sessionId ?? (refreshToken ? this.parseRefreshToken(refreshToken).sessionId : null);
    if (!targetSessionId) {
      return { status: 'logged_out' };
    }

    await this.prisma.authSession.updateMany({
      where: {
        id: targetSessionId,
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });

    return { status: 'logged_out' };
  }

  async requestPasswordReset(email: string) {
    const user = await this.findActiveUser(email);
    const token = randomBytes(32).toString('hex');
    const redis = await this.getRedis();

    await redis.set(
      this.passwordResetKey(user.email),
      JSON.stringify({
        hash: await bcrypt.hash(token, 10),
        createdAt: new Date().toISOString()
      }),
      'EX',
      1800
    );

    await this.writeAuthAudit('password_reset_requested', user.id, {
      email: user.email
    });

    await this.sendEmail({
      to: user.email,
      subject: 'Reset your Unnatify password',
      text: `Use this password reset token within 30 minutes: ${token}`
    });

    return {
      status: 'sent',
      expiresInSeconds: 1800
    };
  }

  async confirmPasswordReset(email: string, token: string, newPassword: string) {
    const normalizedEmail = email.toLowerCase();
    assertPasswordPolicy(newPassword);
    const redis = await this.getRedis();

    const key = this.passwordResetKey(normalizedEmail);
    const stored = await redis.get(key);
    if (!stored) throw new BadRequestException('Password reset token expired or not requested');

    const payload = JSON.parse(stored) as { hash: string };
    const matches = await bcrypt.compare(token, payload.hash);
    if (!matches) throw new BadRequestException('Invalid password reset token');

    const user = await this.findActiveUser(normalizedEmail);
    await this.prisma.user.update({
      where: { email: normalizedEmail },
      data: { passwordHash: await bcrypt.hash(newPassword, 12) }
    });
    await redis.del(key);
    await this.clearFailedLogin(normalizedEmail);

    // Revoke all active sessions so compromised tokens cannot survive a password reset
    await this.prisma.authSession.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() }
    });

    await this.writeAuthAudit('password_reset_completed', user.id, {
      email: normalizedEmail,
      sessionsRevoked: true
    });

    return {
      status: 'updated'
    };
  }

  private async findActiveUser(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user || !user.isActive || user.isSystem) throw new NotFoundException('User not found');
    return user;
  }

  /**
   * Returns a shared, lazy-initialized Redis client.
   * Avoids creating a new TCP connection per auth operation.
   */
  private async getRedis(): Promise<Redis> {
    if (this._redis && this._redis.status === 'ready') return this._redis;
    if (this._redis) {
      try { this._redis.disconnect(); } catch { /* ignore */ }
    }
    this._redis = new Redis(requiredConfigValue('REDIS_URL', this.config.get<string>('REDIS_URL'), 'redis://localhost:6379'), {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: (times: number) => (times > 3 ? null : Math.min(times * 200, 2000))
    });
    await this._redis.connect();
    return this._redis;
  }

  private otpKey(email: string) {
    return `auth:email-otp:${email}`;
  }

  private passwordResetKey(email: string) {
    return `auth:password-reset:${email}`;
  }

  private loginFailureKey(email: string) {
    return `auth:login-failures:${email}`;
  }

  private loginLockKey(email: string) {
    return `auth:login-locked:${email}`;
  }

  private loginFailureLimit() {
    const raw = Number(this.config.get<string>('LOGIN_FAILURE_LIMIT') ?? 5);
    return Number.isFinite(raw) && raw > 0 ? raw : 5;
  }

  private loginLockSeconds() {
    const raw = Number(this.config.get<string>('LOGIN_LOCK_SECONDS') ?? 900);
    return Number.isFinite(raw) && raw > 0 ? raw : 900;
  }

  private async assertLoginNotLocked(email: string, meta: SessionMeta) {
    const redis = await this.getRedis();
    const ttl = await redis.ttl(this.loginLockKey(email));
    if (ttl > 0) {
      await this.writeAuthAudit('login_blocked', email, {
        email,
        reason: 'account_temporarily_locked',
        lockSecondsRemaining: ttl
      }, meta);
      throw new UnauthorizedException(`Too many failed login attempts. Try again in ${ttl} seconds.`);
    }
  }

  private async recordFailedLogin(email: string, userId: string | undefined, reason: string, meta: SessionMeta) {
    const redis = await this.getRedis();
    let failures = 1;
    const lockSeconds = this.loginLockSeconds();

    failures = await redis.incr(this.loginFailureKey(email));
    if (failures === 1) {
      await redis.expire(this.loginFailureKey(email), lockSeconds);
    }
    if (failures >= this.loginFailureLimit()) {
      await redis.set(this.loginLockKey(email), String(failures), 'EX', lockSeconds);
    }

    await this.writeAuthAudit('login_failed', userId ?? email, {
      email,
      reason,
      failureCount: failures
    }, meta);
  }

  private async clearFailedLogin(email: string) {
    const redis = await this.getRedis();
    await redis.del(this.loginFailureKey(email), this.loginLockKey(email));
  }

  private async writeAuthAudit(action: string, entityId: string, value: Record<string, unknown>, meta: SessionMeta = {}) {
    await this.prisma.auditLog.create({
      data: {
        moduleName: 'Auth',
        entityId,
        action,
        newValue: toJsonValue(value),
        changedBy: entityId,
        changedByType: 'system',
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent
      }
    });
  }

  private async isTwoFactorRequired(user: { twoFactorEnabled: boolean; twoFactorDisabledByAdmin: boolean }) {
    if (user.twoFactorDisabledByAdmin) return false;
    const setting = await this.prisma.appSetting.findUnique({
      where: { key: 'security.twoFactor.accountEnabled' }
    });
    const accountEnabled = Boolean((setting?.value as { enabled?: boolean } | null)?.enabled);
    return accountEnabled || user.twoFactorEnabled;
  }

  private async issueLoginResponse(
    user: {
      id: string;
      name: string;
      email: string;
      phone: string | null;
      role: { name: string };
      team?: { name: string } | null;
      permissionTemplate?: { name: string } | null;
    },
    meta: SessionMeta
  ) {
    const session = await this.createSession(user.id, meta);
    return {
      accessToken: await this.signUserToken(user, session.sessionId),
      refreshToken: session.refreshToken,
      refreshTokenExpiresAt: session.expiresAt.toISOString(),
      user: this.publicUser(user)
    };
  }

  private async createSession(userId: string, meta: SessionMeta) {
    const secret = this.newRefreshSecret();
    const expiresAt = new Date(Date.now() + this.refreshTokenDays() * 24 * 60 * 60 * 1000);
    const session = await this.prisma.authSession.create({
      data: {
        userId,
        refreshTokenHash: await bcrypt.hash(secret, 12),
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
        expiresAt
      }
    });

    return {
      sessionId: session.id,
      refreshToken: `${session.id}.${secret}`,
      expiresAt
    };
  }

  private async rotateRefreshToken(sessionId: string) {
    const secret = this.newRefreshSecret();
    await this.prisma.authSession.update({
      where: { id: sessionId },
      data: {
        refreshTokenHash: await bcrypt.hash(secret, 12)
      }
    });
    return {
      refreshToken: `${sessionId}.${secret}`
    };
  }

  private newRefreshSecret() {
    return randomBytes(32).toString('hex');
  }

  private signUserToken(user: { id: string; email: string; role: { name: string } }, sessionId?: string) {
    return this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role.name,
      sid: sessionId
    });
  }

  private parseRefreshToken(refreshToken: string) {
    const [sessionId, secret] = refreshToken.split('.');
    if (!sessionId || !secret) throw new UnauthorizedException('Invalid refresh token');
    return { sessionId, secret };
  }

  private refreshTokenDays() {
    const raw = Number(this.config.get<string>('REFRESH_TOKEN_EXPIRES_DAYS') ?? 30);
    return Number.isFinite(raw) && raw > 0 ? raw : 30;
  }

  private publicUser(user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    role: { name: string };
    team?: { name: string } | null;
    permissionTemplate?: { name: string } | null;
  }) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role.name,
      team: user.team?.name ?? null,
      permissionTemplate: user.permissionTemplate?.name ?? null
    };
  }

  private async sendEmail(message: { to: string; subject: string; text: string }) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const from = this.config.get<string>('RESEND_FROM_EMAIL') ?? 'info@unnatify.com';

    if (!apiKey) throw new BadRequestException('Email provider is not configured');

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to: message.to,
        subject: message.subject,
        text: message.text
      })
    });

    if (!response.ok) throw new BadGatewayException('Email delivery failed');
  }
}
