import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class OpsGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; opsUser?: { email: string } }>();
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) throw new UnauthorizedException('Ops login required');

    try {
      const payload = this.jwt.verify<{ ops: boolean; email: string }>(token);
      if (!payload.ops) throw new UnauthorizedException('Ops login required');
      request.opsUser = { email: payload.email };
      return true;
    } catch {
      throw new UnauthorizedException('Ops login required');
    }
  }
}
