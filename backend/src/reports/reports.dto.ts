import { IsBoolean, IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export class SaveReportDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  reportType?: string;

  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>;

  @IsOptional()
  columns?: unknown[];

  @IsOptional()
  @IsIn(['private', 'team', 'all'])
  visibility?: string;
}

export class ScheduleReportDto {
  @IsOptional()
  @IsString()
  savedReportId?: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  reportType?: string;

  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>;

  @IsIn(['daily', 'weekly', 'monthly'])
  frequency!: string;

  @IsOptional()
  recipients?: string[];

  @IsOptional()
  @IsString()
  nextRunAt?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateReportExportDto {
  @IsOptional()
  @IsString()
  reportType?: string;

  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>;
}
