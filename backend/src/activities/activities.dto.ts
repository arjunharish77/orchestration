import { IsObject, IsOptional, IsString } from 'class-validator';

export class CreateActivityDto {
  @IsOptional()
  @IsString()
  leadId?: string;

  @IsString()
  type!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  disposition?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}

export class UpdateActivityDto {
  @IsOptional()
  @IsString()
  leadId?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  disposition?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}
