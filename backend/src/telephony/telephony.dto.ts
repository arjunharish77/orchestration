import { Allow, IsBoolean, IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export class SaveTelephonyConnectorConfigDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  clickToCallUrl?: string;

  @IsOptional()
  @IsIn(['GET', 'POST'])
  httpMethod?: 'GET' | 'POST';

  @IsOptional()
  @IsString()
  responseKeyword?: string;

  @IsOptional()
  @IsString()
  requestType?: string;

  @IsOptional()
  @IsString()
  responseType?: string;

  @IsOptional()
  @IsString()
  providerSupportEmail?: string;

  @IsOptional()
  @IsString()
  webhookSecret?: string;

  @IsOptional()
  @IsObject()
  customHeaders?: Record<string, unknown>;

  @IsOptional()
  @Allow()
  dataTemplate?: unknown;

  @IsOptional()
  @IsObject()
  popupConfig?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class PreviewTelephonyVariablesDto {
  @Allow()
  template!: unknown;
}

export class ExecuteClickToCallDto {
  @IsString()
  leadId!: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsObject()
  activity?: Record<string, unknown>;
}

export class UpdatePopupDeliveryDto {
  @IsIn(['seen', 'closed'])
  status!: 'seen' | 'closed';

  @IsOptional()
  @IsString()
  sessionId?: string;
}
