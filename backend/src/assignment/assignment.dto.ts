import { IsArray, IsBoolean, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class RunAssignmentDto {
  @IsString()
  leadId!: string;

  @IsOptional()
  @IsString()
  activityId?: string;

  @IsOptional()
  @IsString()
  ruleId?: string;

  @IsOptional()
  @IsString()
  mode?: string;

  @IsOptional()
  context?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  previewOnly?: boolean;
}

export class AssignmentConditionDto {
  @IsString()
  fieldPath!: string;

  @IsString()
  operator!: string;

  @IsOptional()
  value?: unknown;
}

export class AssignmentActionDto {
  @IsString()
  actionType!: string;

  @IsObject()
  config!: Record<string, unknown>;
}

export class UpsertAssignmentRuleDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsNumber()
  priority?: number;

  @IsOptional()
  @IsString()
  targetType?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  conditions?: AssignmentConditionDto[];

  @IsOptional()
  @IsArray()
  actions?: AssignmentActionDto[];
}
