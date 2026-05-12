import { Body, Controller, Get, Header, HttpCode, Param, Post, Query, Req, Sse, UnauthorizedException, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Observable } from 'rxjs';
import { AccessService } from '../access/access.service';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { ExecuteClickToCallDto, PreviewTelephonyVariablesDto, SaveTelephonyConnectorConfigDto, UpdatePopupDeliveryDto } from './telephony.dto';
import { TelephonyService } from './telephony.service';

@Controller('webhooks/telephony')
export class TelephonyController {
  constructor(
    private readonly telephonyService: TelephonyService
  ) {}

  @Get('lead-route')
  @Header('Content-Type', 'text/plain')
  async leadRoute(@Query('caller_id') callerId: string, @Query('secret') secret: string | undefined, @Req() request: { headers: Record<string, string | string[] | undefined> }) {
    await this.telephonyService.assertWebhookSecret(headerValue(request.headers['x-webhook-secret']) ?? secret);
    return this.telephonyService.routeLead(callerId);
  }

  @Post('agent-popup')
  @HttpCode(200)
  async agentPopup(@Body() body: Record<string, unknown>, @Req() request: { headers: Record<string, string | string[] | undefined> }) {
    await this.telephonyService.assertWebhookSecret(headerValue(request.headers['x-webhook-secret']) ?? String(body.secret ?? ''));
    return this.telephonyService.agentPopup(body);
  }

  @Post('call-log-complete')
  @HttpCode(200)
  async callLogComplete(@Body() body: Record<string, unknown>, @Req() request: { headers: Record<string, string | string[] | undefined> }) {
    await this.telephonyService.assertWebhookSecret(headerValue(request.headers['x-webhook-secret']) ?? String(body.secret ?? ''));
    return this.telephonyService.callLogComplete(body);
  }
}

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

type AuthenticatedRequest = {
  user: AuthenticatedUser;
  headers?: Record<string, string | string[] | undefined>;
};

@Controller('connectors/telephony')
export class TelephonyConnectorController {
  constructor(
    private readonly telephonyService: TelephonyService,
    private readonly accessService: AccessService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService
  ) {}

  @Get('reference')
  @UseGuards(JwtAuthGuard)
  async reference(@Req() request: AuthenticatedRequest) {
    await this.accessService.assertModulePermission(request.user.id, 'Connector', 'view');
    return this.telephonyService.connectorReference(requestBaseUrl(request.headers));
  }

  @Post('config')
  @UseGuards(JwtAuthGuard)
  async saveConfig(@Req() request: AuthenticatedRequest, @Body() body: SaveTelephonyConnectorConfigDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Connector', 'manageConnector');
    return this.telephonyService.saveConnectorConfig(body, request.user.id);
  }

  @Post('preview-variables')
  @UseGuards(JwtAuthGuard)
  async previewVariables(@Req() request: AuthenticatedRequest, @Body() body: PreviewTelephonyVariablesDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Connector', 'view');
    return this.telephonyService.previewVariables(body);
  }

  @Get('popups/recent')
  @UseGuards(JwtAuthGuard)
  async recentPopups(@Req() request: AuthenticatedRequest) {
    await this.accessService.assertModulePermission(request.user.id, 'Connector', 'view');
    return this.telephonyService.recentPopups(request.user.id);
  }

  @Post('popups/:id/delivery')
  @UseGuards(JwtAuthGuard)
  async popupDelivery(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: UpdatePopupDeliveryDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Connector', 'view');
    return this.telephonyService.updatePopupDelivery(id, request.user.id, body);
  }

  @Sse('popups/stream')
  async popupStream(@Query('token') token?: string): Promise<Observable<{ type?: string; data: unknown }>> {
    const user = await this.authenticateStreamToken(token);
    await this.accessService.assertModulePermission(user.id, 'Connector', 'view');
    return this.telephonyService.popupStream(user.id);
  }

  @Post('popups/stream-token')
  @UseGuards(JwtAuthGuard)
  async popupStreamToken(@Req() request: AuthenticatedRequest) {
    await this.accessService.assertModulePermission(request.user.id, 'Connector', 'view');
    return {
      token: await this.jwt.signAsync(
        {
          sub: request.user.id,
          email: request.user.email,
          role: request.user.role,
          sid: request.user.sessionId,
          purpose: 'telephony-popup-stream'
        },
        { expiresIn: '2m' }
      ),
      expiresInSeconds: 120
    };
  }

  @Post('agent-heartbeat')
  @UseGuards(JwtAuthGuard)
  async agentHeartbeat(@Req() request: AuthenticatedRequest) {
    await this.accessService.assertModulePermission(request.user.id, 'Connector', 'view');
    return this.telephonyService.agentHeartbeat(request.user.id);
  }

  @Get('online-agents')
  @UseGuards(JwtAuthGuard)
  async onlineAgents(@Req() request: AuthenticatedRequest) {
    await this.accessService.assertModulePermission(request.user.id, 'Connector', 'view');
    return this.telephonyService.onlineAgentSummary();
  }

  @Post('click-to-call')
  @UseGuards(JwtAuthGuard)
  async clickToCall(@Req() request: AuthenticatedRequest, @Body() body: ExecuteClickToCallDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Lead', 'view');
    return this.telephonyService.executeClickToCall(body, request.user.id);
  }

  @Post('test-tools/:kind')
  @UseGuards(JwtAuthGuard)
  async testTool(@Req() request: AuthenticatedRequest, @Param('kind') kind: string, @Body() body: Record<string, unknown>) {
    await this.accessService.assertModulePermission(request.user.id, 'Connector', 'manageConnector');
    if (kind === 'lead-route') return this.telephonyService.routeLead(body.callerId ?? body.caller_id);
    if (kind === 'agent-popup') return this.telephonyService.agentPopup(body);
    if (kind === 'call-log-complete') return this.telephonyService.callLogComplete(body);
    throw new UnauthorizedException('Invalid telephony test tool');
  }

  private async authenticateStreamToken(token?: string): Promise<AuthenticatedUser> {
    if (!token) throw new UnauthorizedException('Missing stream token');
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; email: string; role: string; sid?: string; purpose?: string }>(token);
      if (payload.purpose !== 'telephony-popup-stream') throw new UnauthorizedException('Invalid stream token purpose');
      if (payload.sid) {
        const session = await this.prisma.authSession.findUnique({
          where: { id: payload.sid },
          select: { userId: true, expiresAt: true, revokedAt: true }
        });
        if (!session || session.userId !== payload.sub || session.revokedAt || session.expiresAt <= new Date()) {
          throw new UnauthorizedException('Session expired');
        }
      }
      return {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        sessionId: payload.sid
      };
    } catch {
      throw new UnauthorizedException('Invalid stream token');
    }
  }
}

function requestBaseUrl(headers?: Record<string, string | string[] | undefined>) {
  const forwardedProto = headerValue(headers?.['x-forwarded-proto']);
  const forwardedHost = headerValue(headers?.['x-forwarded-host']);
  const host = forwardedHost ?? headerValue(headers?.host);
  if (!host) return 'http://127.0.0.1:4000';
  return `${forwardedProto ?? 'http'}://${host}`;
}
