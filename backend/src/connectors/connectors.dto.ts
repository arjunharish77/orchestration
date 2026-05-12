import { Allow, IsBoolean, IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateConnectorDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateConnectorDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateWhatsAppConnectorDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateWhatsAppConnectorDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpsertWhatsAppNumberDto {
  @IsString()
  connectorId!: string;

  @IsString()
  phoneNumber!: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateWhatsAppNumberDto {
  @IsOptional()
  @IsString()
  connectorId?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateWhatsAppTemplateDto {
  @IsOptional()
  @IsString()
  connectorId?: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsString()
  content!: string;

  @IsOptional()
  @IsObject()
  mediaConfig?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  availableInChat?: boolean;

  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateWhatsAppTemplateDto {
  @IsOptional()
  @IsString()
  connectorId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsObject()
  mediaConfig?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  availableInChat?: boolean;

  @IsOptional()
  @IsString()
  status?: string;
}

export class SendWhatsAppMessageDto {
  @IsOptional()
  @IsString()
  leadId?: string;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  messageType?: string;

  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @IsOptional()
  @IsString()
  mediaMimeType?: string;

  @IsOptional()
  @IsString()
  mediaFileName?: string;

  @IsOptional()
  @IsString()
  whatsAppNumberId?: string;

  @IsOptional()
  @IsBoolean()
  previewUrl?: boolean;

  @IsOptional()
  @IsObject()
  rawPayload?: Record<string, unknown>;
}

export class CreateVoicebotConnectorDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateVoicebotConnectorDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateVoicebotTriggerTemplateDto {
  @IsString()
  connectorId!: string;

  @IsString()
  name!: string;

  @IsIn(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
  method!: string;

  @IsString()
  url!: string;

  @IsOptional()
  @IsObject()
  headers?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  queryParams?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  bodyTemplate?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  responseConfig?: Record<string, unknown>;
}

export class UpdateVoicebotTriggerTemplateDto {
  @IsOptional()
  @IsString()
  connectorId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
  method?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsObject()
  headers?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  queryParams?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  bodyTemplate?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  responseConfig?: Record<string, unknown>;
}

export class CreateVoicebotWebhookMappingDto {
  @IsString()
  connectorId!: string;

  @IsOptional()
  @IsObject()
  sampleBody?: Record<string, unknown>;

  @IsObject()
  fieldMappings!: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateVoicebotWebhookMappingDto {
  @IsOptional()
  @IsString()
  connectorId?: string;

  @IsOptional()
  @IsObject()
  sampleBody?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  fieldMappings?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class TestVoicebotCallDto {
  @IsOptional()
  @IsObject()
  variables?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

export class VoicebotWebhookDto {
  @Allow()
  payload!: unknown;
}

export class ExtractVariablesDto {
  @Allow()
  template!: unknown;
}
