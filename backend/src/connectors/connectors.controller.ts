import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AccessService } from '../access/access.service';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/auth.guard';
import {
  CreateConnectorDto,
  CreateVoicebotConnectorDto,
  CreateVoicebotTriggerTemplateDto,
  CreateVoicebotWebhookMappingDto,
  CreateWhatsAppConnectorDto,
  CreateWhatsAppTemplateDto,
  ExtractVariablesDto,
  SendWhatsAppMessageDto,
  TestVoicebotCallDto,
  UpdateConnectorDto,
  UpdateVoicebotConnectorDto,
  UpdateVoicebotTriggerTemplateDto,
  UpdateVoicebotWebhookMappingDto,
  UpdateWhatsAppConnectorDto,
  UpdateWhatsAppNumberDto,
  UpdateWhatsAppTemplateDto,
  UpsertWhatsAppNumberDto
} from './connectors.dto';
import { ConnectorsService } from './connectors.service';

type AuthenticatedRequest = {
  user: AuthenticatedUser;
};

type WebhookRequest = {
  headers: Record<string, string | string[] | undefined>;
  rawBody?: string;
};

@Controller('connectors')
export class ConnectorsController {
  constructor(
    private readonly connectorsService: ConnectorsService,
    private readonly accessService: AccessService
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(@Req() request: AuthenticatedRequest) {
    await this.accessService.assertModulePermission(request.user.id, 'Connector', 'view');
    return this.connectorsService.list(request.user.id);
  }

  @Post('api')
  @UseGuards(JwtAuthGuard)
  async createConnector(@Req() request: AuthenticatedRequest, @Body() body: CreateConnectorDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Connector', 'manageConnector');
    return this.connectorsService.createConnector(body, request.user.id);
  }

  @Patch('api/:id')
  @UseGuards(JwtAuthGuard)
  async updateConnector(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: UpdateConnectorDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Connector', 'manageConnector');
    return this.connectorsService.updateConnector(id, body, request.user.id);
  }

  @Delete('api/:id')
  @UseGuards(JwtAuthGuard)
  async deleteConnector(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    await this.accessService.assertModulePermission(request.user.id, 'Connector', 'manageConnector');
    return this.connectorsService.deleteConnector(id, request.user.id);
  }

  @Get('whatsapp/connectors/:id')
  @UseGuards(JwtAuthGuard)
  async getWhatsAppConnector(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    await this.accessService.assertModulePermission(request.user.id, 'Connector', 'view');
    return this.connectorsService.getWhatsAppConnector(id);
  }

  @Get('whatsapp/chat')
  @UseGuards(JwtAuthGuard)
  async whatsAppChat(@Req() request: AuthenticatedRequest) {
    await this.accessService.assertModulePermission(request.user.id, 'Lead', 'view');
    return this.connectorsService.whatsAppChatOverview(request.user.id);
  }

  @Post('whatsapp/connectors')
  @UseGuards(JwtAuthGuard)
  async createWhatsAppConnector(@Req() request: AuthenticatedRequest, @Body() body: CreateWhatsAppConnectorDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Connector', 'manageConnector');
    return this.connectorsService.createWhatsAppConnector(body, request.user.id);
  }

  @Patch('whatsapp/connectors/:id')
  @UseGuards(JwtAuthGuard)
  async updateWhatsAppConnector(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: UpdateWhatsAppConnectorDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Connector', 'manageConnector');
    return this.connectorsService.updateWhatsAppConnector(id, body, request.user.id);
  }

  @Delete('whatsapp/connectors/:id')
  @UseGuards(JwtAuthGuard)
  async deleteWhatsAppConnector(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    await this.accessService.assertModulePermission(request.user.id, 'Connector', 'manageConnector');
    return this.connectorsService.deleteWhatsAppConnector(id, request.user.id);
  }

  @Post('whatsapp/numbers')
  @UseGuards(JwtAuthGuard)
  async upsertWhatsAppNumber(@Req() request: AuthenticatedRequest, @Body() body: UpsertWhatsAppNumberDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Connector', 'manageConnector');
    return this.connectorsService.upsertWhatsAppNumber(body, request.user.id);
  }

  @Patch('whatsapp/numbers/:id')
  @UseGuards(JwtAuthGuard)
  async updateWhatsAppNumber(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: UpdateWhatsAppNumberDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Connector', 'manageConnector');
    return this.connectorsService.updateWhatsAppNumber(id, body, request.user.id);
  }

  @Delete('whatsapp/numbers/:id')
  @UseGuards(JwtAuthGuard)
  async deleteWhatsAppNumber(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    await this.accessService.assertModulePermission(request.user.id, 'Connector', 'manageConnector');
    return this.connectorsService.deleteWhatsAppNumber(id, request.user.id);
  }

  @Patch('whatsapp/templates/:id')
  @UseGuards(JwtAuthGuard)
  async updateWhatsAppTemplate(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: UpdateWhatsAppTemplateDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Connector', 'manageConnector');
    return this.connectorsService.updateWhatsAppTemplate(id, body, request.user.id);
  }

  @Post('whatsapp/templates')
  @UseGuards(JwtAuthGuard)
  async createWhatsAppTemplate(@Req() request: AuthenticatedRequest, @Body() body: CreateWhatsAppTemplateDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Connector', 'manageConnector');
    return this.connectorsService.createWhatsAppTemplate(body, request.user.id);
  }

  @Delete('whatsapp/templates/:id')
  @UseGuards(JwtAuthGuard)
  async deleteWhatsAppTemplate(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    await this.accessService.assertModulePermission(request.user.id, 'Connector', 'manageConnector');
    return this.connectorsService.deleteWhatsAppTemplate(id, request.user.id);
  }

  @Post('whatsapp/connectors/:id/sync-templates')
  @UseGuards(JwtAuthGuard)
  async syncWhatsAppTemplates(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    await this.accessService.assertModulePermission(request.user.id, 'Connector', 'manageConnector');
    return this.connectorsService.syncWhatsAppTemplates(id, request.user.id);
  }

  @Post('whatsapp/conversations/:id/end')
  @UseGuards(JwtAuthGuard)
  async endWhatsAppConversation(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    await this.accessService.assertModulePermission(request.user.id, 'Lead', 'view');
    return this.connectorsService.endWhatsAppConversation(id, request.user.id);
  }

  @Post('whatsapp/messages')
  @UseGuards(JwtAuthGuard)
  async sendWhatsAppMessage(@Req() request: AuthenticatedRequest, @Body() body: SendWhatsAppMessageDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Lead', 'view');
    return this.connectorsService.createOutboundWhatsAppMessage(body, request.user.id);
  }

  @Post('whatsapp/webhook')
  @HttpCode(200)
  async whatsAppWebhook(@Body() body: Record<string, unknown>, @Req() request: WebhookRequest) {
    const signature = headerValue(request.headers['x-hub-signature-256']);
    if (!await this.connectorsService.verifyWhatsAppWebhookSignature(signature, request.rawBody)) throw new UnauthorizedException('Invalid WhatsApp webhook signature');
    const providedSecret = headerValue(request.headers['x-webhook-secret']) ?? String(body.secret ?? '');
    if (!await this.connectorsService.verifyWhatsAppWebhookSecret(providedSecret)) throw new UnauthorizedException('Invalid WhatsApp webhook secret');
    return this.connectorsService.ingestWhatsAppWebhook(body);
  }

  @Get('whatsapp/webhook')
  async verifyWhatsAppWebhook(
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') verifyToken?: string,
    @Query('hub.challenge') challenge?: string
  ) {
    if (mode === 'subscribe' && await this.connectorsService.verifyWhatsAppWebhookToken(verifyToken)) return challenge ?? '';
    throw new UnauthorizedException('Invalid WhatsApp webhook verification token');
  }

  @Post('voicebot/connectors')
  @UseGuards(JwtAuthGuard)
  async createVoicebotConnector(@Req() request: AuthenticatedRequest, @Body() body: CreateVoicebotConnectorDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Connector', 'manageConnector');
    return this.connectorsService.createVoicebotConnector(body, request.user.id);
  }

  @Get('voicebot/connectors/:id')
  @UseGuards(JwtAuthGuard)
  async getVoicebotConnector(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    await this.accessService.assertModulePermission(request.user.id, 'Connector', 'view');
    return this.connectorsService.getVoicebotConnector(id);
  }

  @Patch('voicebot/connectors/:id')
  @UseGuards(JwtAuthGuard)
  async updateVoicebotConnector(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: UpdateVoicebotConnectorDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Connector', 'manageConnector');
    return this.connectorsService.updateVoicebotConnector(id, body, request.user.id);
  }

  @Delete('voicebot/connectors/:id')
  @UseGuards(JwtAuthGuard)
  async deleteVoicebotConnector(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    await this.accessService.assertModulePermission(request.user.id, 'Connector', 'manageConnector');
    return this.connectorsService.deleteVoicebotConnector(id, request.user.id);
  }

  @Post('voicebot/templates')
  @UseGuards(JwtAuthGuard)
  async createVoicebotTemplate(@Req() request: AuthenticatedRequest, @Body() body: CreateVoicebotTriggerTemplateDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Connector', 'manageConnector');
    return this.connectorsService.createVoicebotTemplate(body, request.user.id);
  }

  @Patch('voicebot/templates/:id')
  @UseGuards(JwtAuthGuard)
  async updateVoicebotTemplate(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: UpdateVoicebotTriggerTemplateDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Connector', 'manageConnector');
    return this.connectorsService.updateVoicebotTemplate(id, body, request.user.id);
  }

  @Delete('voicebot/templates/:id')
  @UseGuards(JwtAuthGuard)
  async deleteVoicebotTemplate(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    await this.accessService.assertModulePermission(request.user.id, 'Connector', 'manageConnector');
    return this.connectorsService.deleteVoicebotTemplate(id, request.user.id);
  }

  @Post('voicebot/templates/:id/test-call')
  @UseGuards(JwtAuthGuard)
  async testVoicebotCall(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: TestVoicebotCallDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Connector', 'manageConnector');
    return this.connectorsService.testVoicebotCall(id, body, request.user.id);
  }

  @Post('voicebot/webhook-mappings')
  @UseGuards(JwtAuthGuard)
  async createVoicebotWebhookMapping(@Req() request: AuthenticatedRequest, @Body() body: CreateVoicebotWebhookMappingDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Connector', 'manageConnector');
    return this.connectorsService.createVoicebotWebhookMapping(body, request.user.id);
  }

  @Patch('voicebot/webhook-mappings/:id')
  @UseGuards(JwtAuthGuard)
  async updateVoicebotWebhookMapping(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: UpdateVoicebotWebhookMappingDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Connector', 'manageConnector');
    return this.connectorsService.updateVoicebotWebhookMapping(id, body, request.user.id);
  }

  @Delete('voicebot/webhook-mappings/:id')
  @UseGuards(JwtAuthGuard)
  async deleteVoicebotWebhookMapping(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    await this.accessService.assertModulePermission(request.user.id, 'Connector', 'manageConnector');
    return this.connectorsService.deleteVoicebotWebhookMapping(id, request.user.id);
  }

  @Post('voicebot/webhook/:connectorId')
  @HttpCode(200)
  async voicebotWebhook(@Param('connectorId') connectorId: string, @Body() body: Record<string, unknown>, @Req() request: WebhookRequest) {
    await this.connectorsService.assertVoicebotWebhookSecret(connectorId, headerValue(request.headers['x-webhook-secret']) ?? String(body.secret ?? ''));
    return this.connectorsService.ingestVoicebotWebhook(connectorId, body);
  }

  @Post('extract-variables')
  @UseGuards(JwtAuthGuard)
  async extractVariables(@Req() request: AuthenticatedRequest, @Body() body: ExtractVariablesDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Connector', 'manageConnector');
    return this.connectorsService.extractTemplateVariables(body);
  }
}

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
