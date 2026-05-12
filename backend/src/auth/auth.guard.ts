import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

export type AuthenticatedUser = {
  id: string;
  email: string;
  role: string;
  sessionId?: string;
};

type RequestWithUser = {
  headers: Record<string, string | string[] | undefined>;
  user?: AuthenticatedUser;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = extractAccessToken(request);
    if (!token) throw new UnauthorizedException('Missing access token');

    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; email: string; role: string; sid?: string }>(token);
      if (payload.sid) {
        const session = await this.prisma.authSession.findUnique({
          where: { id: payload.sid },
          select: { id: true, userId: true, expiresAt: true, revokedAt: true }
        });

        if (!session || session.userId !== payload.sub || session.revokedAt || session.expiresAt <= new Date()) {
          throw new UnauthorizedException('Session expired');
        }
      }

      request.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        sessionId: payload.sid
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }
}

function extractAccessToken(request: RequestWithUser) {
  return extractBearerToken(request.headers.authorization) ?? extractCookie(request.headers.cookie, 'unnatify_access_token');
}

function extractBearerToken(value: string | string[] | undefined) {
  const header = Array.isArray(value) ? value[0] : value;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

function extractCookie(value: string | string[] | undefined, name: string) {
  const header = Array.isArray(value) ? value[0] : value;
  if (!header) return null;
  const cookie = header
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${name}=`));
  if (!cookie) return null;
  return decodeURIComponent(cookie.slice(name.length + 1));
}
